import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { refundCharge } from "@/lib/shopify-channel/stripe";
import { roundMoney } from "@/lib/shopify-channel/money";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { orderId?: string; amount?: number; cancelWarehouse?: boolean };
  if (!body.orderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });
  const order = await db.channelOrder.findUnique({ where: { id: body.orderId } });
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
  if (body.cancelWarehouse && order.bcOrderId && order.status !== "SHIPPED") {
    await bc().cancelOrder(order.bcOrderId);
  }
  await db.channelOrder.update({
    where: { id: order.id },
    data: {
      amountRefunded: refunded,
      status: refunded >= Number(order.amountCharged) ? "REFUNDED" : order.status,
    },
  });
  return NextResponse.json({ ok: true, refunded });
}
