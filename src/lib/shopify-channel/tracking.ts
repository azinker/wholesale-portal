import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { decrypt } from "@/lib/bigcommerce/encryption";
import { emailAccount } from "./notify";
import { createFulfillment } from "./shopify-admin";

export async function pushChannelTracking(bcOrderId: number): Promise<void> {
  if (!bcOrderId) return;
  const order = await db.channelOrder.findFirst({
    where: { bcOrderId },
    include: { connection: true, account: true },
  });
  if (!order) return;
  const shipments = await bc().getOrderShipments(bcOrderId);
  const latest = shipments.filter((row) => row.tracking_number).at(-1);
  if (!latest) return;
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
    await emailAccount(
      order.account.email,
      `Tracking for ${order.shopifyOrderName}`,
      `${order.shopifyOrderName} shipped. ${latest.shipping_method} ${latest.tracking_number}. Your Shopify store emails your customer.`
    );
  }
}
