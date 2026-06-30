import { createHmac, timingSafeEqual } from "crypto";
import { bcCredentials } from "@/lib/env";

/**
 * Verify BigCommerce webhook HMAC-SHA256 signature (X-BC-Signature header).
 * @see https://developer.bigcommerce.com/docs/webhooks/webhook-events
 */
export function verifyBigCommerceWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;

  const { clientSecret } = bcCredentials();
  if (!clientSecret) return false;

  const computed = createHmac("sha256", clientSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(signatureHeader.trim());
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
