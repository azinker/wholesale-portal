import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { MAX_SHOPS_PER_ACCOUNT } from "@/lib/shopify-channel/constants";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { normalizeShopDomain, oauthStartUrl, shopifyAppConfigured, signOauthState } from "@/lib/shopify-channel/shopify-admin";

export async function GET(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_billing");
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!(await channelVisibility(auth.user.email)).visible || !shopifyAppConfigured()) {
    return NextResponse.redirect(new URL("/my-shopify", req.url));
  }
  const shop = normalizeShopDomain(req.nextUrl.searchParams.get("shop") || "");
  if (!shop) return NextResponse.redirect(new URL("/my-shopify", req.url));

  const accountId = auth.user.wholesaleAccount!.id;
  const existing = await db.shopifyConnection.findUnique({ where: { shopDomain: shop } });
  if (existing && existing.accountId !== accountId) {
    return NextResponse.redirect(new URL("/my-shopify", req.url));
  }
  const active = await db.shopifyConnection.count({
    where: { accountId, disconnectedAt: null },
  });
  if (!existing && active >= MAX_SHOPS_PER_ACCOUNT) {
    return NextResponse.redirect(new URL("/my-shopify", req.url));
  }
  const state = signOauthState(accountId, shop);
  return NextResponse.redirect(oauthStartUrl(shop, state));
}
