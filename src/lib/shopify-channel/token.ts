import { decrypt, encrypt } from "@/lib/bigcommerce/encryption";
import { db } from "@/lib/db";
import { refreshOauthToken } from "./shopify-admin";

const REFRESH_EARLY_MS = 5 * 60 * 1000;

type StoredConnection = {
  id: string;
  shopDomain: string;
  accessTokenEnc: string | null;
  refreshTokenEnc?: string | null;
  tokenExpiresAt?: Date | null;
};

/** Returns a Shopify access token Shopify will still accept. Refreshes it when it is close to expiring. */
export async function liveShopifyToken(connection: StoredConnection): Promise<string | null> {
  if (!connection.accessTokenEnc) return null;
  const current = decrypt(connection.accessTokenEnc);
  const refreshEnc = connection.refreshTokenEnc || null;
  const expiresAt = connection.tokenExpiresAt || null;
  if (!refreshEnc) return current;
  if (expiresAt && expiresAt.getTime() - Date.now() > REFRESH_EARLY_MS) return current;
  try {
    const next = await refreshOauthToken(connection.shopDomain, decrypt(refreshEnc));
    await db.shopifyConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: encrypt(next.accessToken),
        refreshTokenEnc: next.refreshToken ? encrypt(next.refreshToken) : refreshEnc,
        tokenExpiresAt: next.expiresAt,
      },
    });
    return next.accessToken;
  } catch (error) {
    console.error("shopify token refresh failed", error instanceof Error ? error.message : "refresh failed");
    if (expiresAt && expiresAt.getTime() > Date.now()) return current;
    return null;
  }
}
