import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { isShopifyChannelEnabled, setShopifyChannelEnabled } from "@/lib/shopify-channel/settings";
import { drainQueuedChannelOrders } from "@/lib/shopify-channel/orders";

export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const enabled = await isShopifyChannelEnabled();
  try {
  const orders = await db.channelOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { account: { select: { companyName: true, email: true } }, connection: { select: { shopDomain: true } } },
  });
  return NextResponse.json({
    enabled,
    orders: orders.map((order) => ({
      id: order.id,
      company: order.account.companyName,
      email: order.account.email,
      shop: order.connection.shopDomain,
      name: order.shopifyOrderName,
      status: order.status,
      amount: order.amountCharged.toString(),
      stripeChargeId: order.stripeChargeId,
      bcOrderId: order.bcOrderId,
      note: order.attentionNote,
      error: order.error,
    })),
  });
  } catch {
    return NextResponse.json({ enabled, orders: [], schemaReady: false });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { enabled?: boolean };
  const enabled = Boolean(body.enabled);
  try {
    await db.channelOrder.count();
  } catch {
    return NextResponse.json(
      { error: "The Shopify channel tables are not in the database yet." },
      { status: 503 }
    );
  }
  await setShopifyChannelEnabled(enabled);
  if (enabled) await drainQueuedChannelOrders();
  return NextResponse.json({ enabled });
}
