import { createHmac, timingSafeEqual } from "crypto";

import { bcCredentials } from "@/lib/env";

export const WEBHOOK_AUTH_HEADER = "x-tpp-webhook-auth";

function hmacBase64(key: string, rawBody: string): string {
  return createHmac("sha256", key).update(rawBody, "utf8").digest("base64");
}

function safeEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a);
    const right = Buffer.from(b.trim());
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function matchesSignature(rawBody: string, signatureHeader: string, key: string): boolean {
  if (!key) return false;
  return safeEqual(hmacBase64(key, rawBody), signatureHeader);
}

/** Shared secret sent as a custom header on BC webhook registrations. */
export function verifyWebhookCustomAuth(headerValue: string | null): boolean {
  const expected = process.env.BC_WEBHOOK_AUTH_SECRET?.trim();
  if (!expected || !headerValue) return false;
  return safeEqual(expected, headerValue.trim());
}

/**
 * Verify BigCommerce webhook HMAC-SHA256 signature (X-BC-Signature header).
 * Tries raw client secret, base64-encoded secret as key, and access token.
 */
export function verifyBigCommerceWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;

  const { clientSecret, accessToken } = bcCredentials();
  const secret = clientSecret?.trim() ?? "";
  const token = accessToken?.trim() ?? "";

  if (!secret && !token) return false;

  const candidates = [
    secret,
    Buffer.from(secret, "utf8").toString("base64"),
    token,
  ].filter(Boolean);

  return candidates.some((key) => matchesSignature(rawBody, signatureHeader, key));
}

export function isBigCommerceWebhookAuthorized(
  rawBody: string,
  headers: { get(name: string): string | null }
): boolean {
  if (verifyWebhookCustomAuth(headers.get(WEBHOOK_AUTH_HEADER))) {
    return true;
  }
  return verifyBigCommerceWebhookSignature(rawBody, headers.get("x-bc-signature"));
}
