import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { refundCharge } from "@/lib/shopify-channel/stripe";
import { roundMoney } from "@/lib/shopify-channel/money";
import { sendAdminChannelRefundEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { orderId?: string; amount?: number; cancelWarehouse?: boolean };
  if (!body.orderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });
  const order = await db.channelOrder.findUnique({
    where: { id: body.orderId },
    include: { account: { select: { email: true, companyName: true } } },
  });
  if (!order?.stripeChargeId) {
    return NextResponse.json({ error: "This order has no charge to refund" }, { status: 400 });
  }
  const remaining = roundMoney(Number(order.amountCharged) - Number(order.amountRefunded));
  const amount = body.amount == null ? remaining : roundMoney(body.amount);
  if (amount <= 0 || amount > remaining) {
    return NextResponse.json({ error: "Refund amount is outside what is left on this charge" }, { status: 400 });
  }
  await refundCharge(order.stripeChargeId, Math.round(amount * 100));
  const refunded = roundMoney(Number(order.amountRefunded) + amount);
  const alreadyShipped = order.status === "SHIPPED";
  const fullyRefunded = refunded >= Number(order.amountCharged);
  const stopShipment = Boolean(body.cancelWarehouse) && !alreadyShipped;
  const statusId = stopShipment || (fullyRefunded && !alreadyShipped) ? 5 : fullyRefunded ? 4 : 14;
  let warehouseStatus: "cancelled" | "refunded" | "partial" | "unchanged" = "unchanged";
  if (order.bcOrderId) {
    const note = fullyRefunded
      ? "The Perfect Part refunded the dropshipper's card for this Shopify order. This does not refund the customer who bought it on their store."
      : "The Perfect Part refunded part of the dropshipper's card for this Shopify order. This does not refund the customer who bought it on their store.";
    try {
      await bc().updateOrderStatus(order.bcOrderId, statusId, note);
      warehouseStatus = statusId === 5 ? "cancelled" : statusId === 4 ? "refunded" : "partial";
    } catch (error) {
      console.error("Warehouse status after refund failed:", error);
    }
  }
  await db.channelOrder.update({
    where: { id: order.id },
    data: {
      amountRefunded: refunded,
      status: fullyRefunded ? "REFUNDED" : order.status,
    },
  });
  await db.auditLog.create({
    data: {
      actorEmail: user.email,
      action: "admin_channel_refund",
      targetAccountId: order.accountId,
      details: {
        orderId: order.id,
        shopifyOrderName: order.shopifyOrderName,
        accountEmail: order.account.email,
        amount,
        warehouseStatus,
        alreadyShipped,
      },
    },
  });
  await sendAdminChannelRefundEmail({
    to: order.account.email,
    orderName: order.shopifyOrderName,
    orderId: order.id,
    amount,
    warehouseStatus,
  });
  return NextResponse.json({ ok: true, refunded, shipmentStopped: warehouseStatus === "cancelled" });
}
