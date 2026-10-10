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
    include: { account: { select: { email: true, companyName: true, customerId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const creditOnOrder = roundMoney(Number(order.storeCreditApplied || 0));
  if (!order.stripeChargeId && creditOnOrder <= 0) {
    return NextResponse.json({ error: "This order has no charge to refund" }, { status: 400 });
  }
  const remaining = roundMoney(Number(order.amountCharged) - Number(order.amountRefunded));
  const amount = body.amount == null ? remaining : roundMoney(body.amount);
  if (remaining > 0 && (amount <= 0 || amount > remaining)) {
    return NextResponse.json({ error: "Refund amount is outside what is left on this charge" }, { status: 400 });
  }
  if (remaining <= 0 && creditOnOrder <= 0) {
    return NextResponse.json({ error: "This order has no charge to refund" }, { status: 400 });
  }
  const cardRefund = remaining > 0 ? amount : 0;
  if (order.stripeChargeId && cardRefund > 0) {
    await refundCharge(order.stripeChargeId, Math.round(cardRefund * 100));
  }
  const refunded = roundMoney(Number(order.amountRefunded) + cardRefund);
  const alreadyShipped = order.status === "SHIPPED";
  const fullyRefunded = refunded >= Number(order.amountCharged);
  let creditRestored = 0;
  if (fullyRefunded && creditOnOrder > 0 && order.account.customerId) {
    try {
      const customer = await bc().getCustomerById(order.account.customerId);
      const current = roundMoney(Number(customer?.store_credit_amounts?.[0]?.amount || 0));
      await bc().setStoreCredit(order.account.customerId, roundMoney(current + creditOnOrder));
      creditRestored = creditOnOrder;
    } catch (error) {
      console.error("Store credit was not put back after refund:", error);
    }
  }
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
      storeCreditApplied: creditRestored > 0 ? 0 : undefined,
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
