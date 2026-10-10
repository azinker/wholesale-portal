import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { decrypt } from "@/lib/bigcommerce/encryption";
import { sendChannelShippedEmail } from "@/lib/email";
import { createFulfillment } from "./shopify-admin";

export async function syncPendingShipments(accountId?: string): Promise<number> {
  const rows = await db.channelOrder.findMany({
    where: {
      status: { in: ["SUBMITTED", "PICKING"] },
      bcOrderId: { not: null },
      ...(accountId ? { accountId } : {}),
    },
    select: { bcOrderId: true },
    orderBy: { updatedAt: "asc" },
    take: 25,
  });
  let shipped = 0;
  for (const row of rows) {
    if (!row.bcOrderId) continue;
    if (await pushChannelTracking(row.bcOrderId)) shipped += 1;
  }
  return shipped;
}

export async function pushChannelTracking(bcOrderId: number): Promise<boolean> {
  if (!bcOrderId) return false;
  const order = await db.channelOrder.findFirst({
    where: { bcOrderId },
    include: { connection: true, account: true },
  });
  if (!order) return false;
  const shipments = await bc().getOrderShipments(bcOrderId);
  const latest = shipments.filter((row) => row.tracking_number).at(-1);
  if (!latest) return false;
  const changed = latest.tracking_number !== order.trackingNumber;
  await db.channelOrder.update({
    where: { id: order.id },
    data: {
      status: "SHIPPED",
      carrier: latest.shipping_method,
      trackingNumber: latest.tracking_number,
    },
  });
  const token = order.connection.accessTokenEnc ? decrypt(order.connection.accessTokenEnc) : null;
  if (token && changed) {
    await createFulfillment({
      shop: order.connection.shopDomain,
      token,
      orderId: order.shopifyOrderId,
      trackingNumber: latest.tracking_number,
      carrier: latest.shipping_method,
    }).catch(() => undefined);
    await sendChannelShippedEmail({
      to: order.account.email,
      orderName: order.shopifyOrderName,
      orderId: order.id,
      carrier: latest.shipping_method || "",
      trackingNumber: latest.tracking_number,
    });
  }
  return true;
}
