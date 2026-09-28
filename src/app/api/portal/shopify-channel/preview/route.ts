import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { newWebhookToken } from "@/lib/shopify-channel/shopify-admin";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount();
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  const access = await channelVisibility(auth.user.email);
  if (!access.preview) {
    return NextResponse.json({ error: "A sample order is only for preview, before the channel is on." }, { status: 403 });
  }
  const account = auth.user.wholesaleAccount;
  const shopDomain = `preview-${account.id}.myshopify.com`;
  const connection = await db.shopifyConnection.upsert({
    where: { shopDomain },
    create: {
      accountId: account.id,
      shopDomain,
      webhookToken: newWebhookToken(),
      addressTestStatus: "PASSED",
      currency: "USD",
    },
    update: { disconnectedAt: null, addressTestStatus: "PASSED" },
  });
  await db.channelOrder.upsert({
    where: { connectionId_shopifyOrderId: { connectionId: connection.id, shopifyOrderId: "preview" } },
    create: {
      accountId: account.id,
      connectionId: connection.id,
      shopifyOrderId: "preview",
      shopifyOrderName: "#PREVIEW",
      status: "SUBMITTED",
      tier: account.lastTier,
      soldFor: 49.99,
      goodsCharged: 34.99,
      shippingCharged: 0,
      amountCharged: 34.99,
      shipTo: {
        name: "Sample Buyer",
        street: "100 Example Ave",
        city: "Miami",
        province: "FL",
        country: "US",
        zip: "33101",
        phone: "305-555-0100",
      },
      lines: [
        { title: "Sample product", quantity: 1, salePrice: 49.99, unitCost: 34.99, lineCost: 34.99 },
      ],
      checkoutNote: "Leave on the porch",
      carrier: "UPS",
      trackingNumber: "1ZPREVIEW",
      trackingUrl: "https://www.ups.com/track?tracknum=1ZPREVIEW",
      chargedAt: new Date(),
    },
    update: {},
  });
  return NextResponse.redirect(appUrl("/my-shopify"), 303);
}
