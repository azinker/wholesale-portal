import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";

import {
  verifyBigCommerceWebhookSignature,
  verifyWebhookCustomAuth,
  WEBHOOK_AUTH_HEADER,
} from "@/lib/bigcommerce/verify-webhook";

function hmacBase64(key: string, rawBody: string): string {
  return createHmac("sha256", key).update(rawBody, "utf8").digest("base64");
}

describe("BigCommerce webhook auth", () => {
  const secret = "test-client-secret";
  const body = '{"scope":"store/customer/updated","data":{"type":"customer","id":1}}';

  it("exports auth header name", () => {
    expect(WEBHOOK_AUTH_HEADER).toBe("x-tpp-webhook-auth");
  });

  it("matches raw client secret as HMAC key", () => {
    const sig = hmacBase64(secret, body);
    expect(hmacBase64(secret, body)).toBe(sig);
  });

  it("matches base64-encoded secret as HMAC key", () => {
    const encodedKey = Buffer.from(secret, "utf8").toString("base64");
    const sig = hmacBase64(encodedKey, body);
    expect(hmacBase64(encodedKey, body)).toBe(sig);
  });

  it("accepts matching custom auth header", () => {
    process.env.BC_WEBHOOK_AUTH_SECRET = "shared-secret";
    expect(verifyWebhookCustomAuth("shared-secret")).toBe(true);
    expect(verifyWebhookCustomAuth("wrong")).toBe(false);
    delete process.env.BC_WEBHOOK_AUTH_SECRET;
  });

  it("rejects missing signature when no custom auth", () => {
    expect(verifyBigCommerceWebhookSignature(body, null)).toBe(false);
  });
});
