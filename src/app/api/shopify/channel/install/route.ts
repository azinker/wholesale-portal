import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { INSTALL_STATE_ACCOUNT } from "@/lib/shopify-channel/constants";
import { normalizeShopDomain, oauthStartUrl, shopifyAppConfigured, signOauthState } from "@/lib/shopify-channel/shopify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify opens the app address with shop, hmac, host and timestamp when a merchant installs
 * from the App Store or opens the app from their admin. A standalone app must answer with a
 * redirect to Shopify's authorization page (authorization code grant). Shopify then calls the
 * callback with a code, the callback exchanges it, and the merchant lands on the app page.
 */
export async function GET(req: NextRequest) {
  const shop = normalizeShopDomain(req.nextUrl.searchParams.get("shop") || "");
  if (!shop || !shopifyAppConfigured()) return NextResponse.redirect(appUrl("/"));
  const state = signOauthState(INSTALL_STATE_ACCOUNT, shop);
  return NextResponse.redirect(oauthStartUrl(shop, state), 302);
}
