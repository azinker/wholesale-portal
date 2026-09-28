import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/bigcommerce/encryption";
import { SHOPIFY_OAUTH_SCOPES } from "@/lib/shopify-channel/constants";
import {
  exchangeOauthCode,
  newWebhookToken,
  readOauthState,
  readPrimaryLocationId,
  readShopCurrency,
  verifyOauthHmac,
} from "@/lib/shopify-channel/shopify-admin";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const home = appUrl("/my-shopify");
  if (!verifyOauthHmac(params)) return NextResponse.redirect(home);
  const shop = params.get("shop") || "";
  const code = params.get("code") || "";
  const state = readOauthState(params.get("state") || "");
  if (!state || state.shop !== shop || !code) return NextResponse.redirect(home);

  const token = await exchangeOauthCode(shop, code);
  const currency = await readShopCurrency(shop, token);
  if (currency !== "USD") return NextResponse.redirect(home);
  const locationId = await readPrimaryLocationId(shop, token);
  const existing = await db.shopifyConnection.findUnique({ where: { shopDomain: shop } });
  if (existing && existing.accountId !== state.accountId) return NextResponse.redirect(home);

  const data = {
    accessTokenEnc: encrypt(token),
    currency,
    scopes: SHOPIFY_OAUTH_SCOPES,
    primaryLocationId: locationId,
    disconnectedAt: null,
  };
  if (existing) {
    await db.shopifyConnection.update({ where: { id: existing.id }, data });
  } else {
    await db.shopifyConnection.create({
      data: {
        accountId: state.accountId,
        shopDomain: shop,
        webhookToken: newWebhookToken(),
        ...data,
      },
    });
  }
  return NextResponse.redirect(home);
}
