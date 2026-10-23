import { NextRequest, NextResponse } from "next/server";
import { appOrigin, appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/bigcommerce/encryption";
import { INSTALL_STATE_ACCOUNT, SHOPIFY_OAUTH_SCOPES } from "@/lib/shopify-channel/constants";
import { emailShopifyStoreConnected } from "@/lib/shopify-channel/notify";
import {
  exchangeOauthCode,
  ensureOrderWebhooks,
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

  if (state.accountId === INSTALL_STATE_ACCOUNT) {
    return finishShopifyInstall(shop, code, params.get("host"));
  }

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
  let connectionId = existing?.id || "";
  let webhookToken = existing?.webhookToken || "";
  if (existing) {
    await db.shopifyConnection.update({ where: { id: existing.id }, data });
  } else {
    const created = await db.shopifyConnection.create({
      data: {
        accountId: state.accountId,
        shopDomain: shop,
        webhookToken: newWebhookToken(),
        ...data,
      },
    });
    connectionId = created.id;
    webhookToken = created.webhookToken;
  }
  const ready = await ensureOrderWebhooks(
    shop,
    token,
    `${appOrigin()}/api/shopify/channel/webhook/${connectionId}/${webhookToken}`
  );
  if (ready) {
    await db.shopifyConnection.update({
      where: { id: connectionId },
      data: { addressTestStatus: "PASSED", addressSource: "WEBHOOK" },
    });
  }
  const account = await db.wholesaleAccount.findUnique({
    where: { id: state.accountId },
    select: { companyName: true, email: true },
  });
  if (account) {
    await emailShopifyStoreConnected({
      companyName: account.companyName,
      email: account.email,
      shopDomain: shop,
      reconnected: Boolean(existing),
      ready,
    }).catch((error) => {
      console.error("shopify store connected email failed", error instanceof Error ? error.message : "send failed");
    });
  }
  return NextResponse.redirect(home);
}

/**
 * Install started from Shopify (App Store or admin), not from a signed-in wholesaler.
 * Exchanging the code is what completes the install on Shopify's side. Then the merchant
 * must land on the app page with shop and host. If this store is already connected to a
 * wholesale account, keep that connection current with the fresh token.
 */
async function finishShopifyInstall(shop: string, code: string, host: string | null) {
  const landing = new URL(appUrl("/my-shopify"));
  landing.searchParams.set("shop", shop);
  if (host && /^[A-Za-z0-9+/=_-]+$/.test(host)) landing.searchParams.set("host", host);
  try {
    const token = await exchangeOauthCode(shop, code);
    const existing = await db.shopifyConnection.findUnique({ where: { shopDomain: shop } });
    if (existing && !existing.disconnectedAt) {
      await db.shopifyConnection.update({ where: { id: existing.id }, data: { accessTokenEnc: encrypt(token) } });
    }
  } catch (error) {
    console.error("shopify install exchange failed", error instanceof Error ? error.message : "exchange failed");
  }
  return NextResponse.redirect(landing, 302);
}
