import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function validShopifyHmac(rawBody: string, header: string, secret: string): boolean {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Mandatory privacy webhooks for the public app. Shopify signs these with the app secret. */
export async function POST(req: NextRequest) {
  const secret = process.env.SHOPIFY_CHANNEL_CLIENT_SECRET?.trim();
  const header = req.headers.get("x-shopify-hmac-sha256") || "";
  const raw = await req.text();
  if (!secret || !header || !validShopifyHmac(raw, header, secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
