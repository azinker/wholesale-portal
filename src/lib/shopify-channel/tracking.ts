import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { decrypt } from "@/lib/bigcommerce/encryption";
import { sendChannelShippedEmail } from "@/lib/email";
import { createFulfillment, looksLikeUsps, pointFulfillmentAtCarrier, readFulfillments, uspsTrackingUrl } from "./shopify-admin";

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
  if (order.status === "REFUNDED") return false;
  const changed = latest.tracking_number !== order.trackingNumber;
  const trackingUrl = looksLikeUsps(latest.tracking_number) ? uspsTrackingUrl(latest.tracking_number) : order.trackingUrl;
  await db.channelOrder.update({
    where: { id: order.id },
    data: {
      status: order.status === "DELIVERED" ? "DELIVERED" : "SHIPPED",
      carrier: latest.shipping_method,
      trackingNumber: latest.tracking_number,
      trackingUrl,
      shippedAt: order.shippedAt ?? new Date(),
    },
  });
  const token = order.connection.accessTokenEnc ? decrypt(order.connection.accessTokenEnc) : null;
  if (token && changed) {
    await createFulfillment({
      shop: order.connection.shopDomain,
      token,
      orderId: order.shopifyOrderId,
      trackingNumber: latest.tracking_number,
      trackingUrl,
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

/** Ask Shopify whether a shipped USPS package has been delivered. */
export async function syncDeliveredShipments(limit = 15): Promise<number> {
  const rows = await db.channelOrder.findMany({
    where: { status: "SHIPPED", trackingNumber: { not: null } },
    include: { connection: true },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  let delivered = 0;
  for (const row of rows) {
    const number = row.trackingNumber;
    const token = row.connection.accessTokenEnc ? decrypt(row.connection.accessTokenEnc) : null;
    if (!number || !token) continue;
    const fulfillments = await readFulfillments(row.connection.shopDomain, token, row.shopifyOrderId).catch(() => []);
    const match = fulfillments.find((item) => item.tracking_number === number) || fulfillments.at(-1);
    if (match && looksLikeUsps(number) && (match.tracking_company || "").toUpperCase() !== "USPS") {
      await pointFulfillmentAtCarrier({
        shop: row.connection.shopDomain,
        token,
        fulfillmentId: match.id,
        trackingNumber: number,
        company: "USPS",
        url: uspsTrackingUrl(number),
      }).catch(() => undefined);
    }
    const trackingUrl = looksLikeUsps(number) ? uspsTrackingUrl(number) : row.trackingUrl;
    if ((match?.shipment_status || "").toLowerCase() !== "delivered") {
      if (trackingUrl && trackingUrl !== row.trackingUrl) {
        await db.channelOrder.update({
          where: { id: row.id },
          data: { trackingUrl, shippedAt: row.shippedAt ?? row.updatedAt },
        });
      }
      continue;
    }
    await db.channelOrder.update({
      where: { id: row.id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        trackingUrl,
        shippedAt: row.shippedAt ?? row.updatedAt,
      },
    });
    delivered += 1;
  }
  return delivered;
}
