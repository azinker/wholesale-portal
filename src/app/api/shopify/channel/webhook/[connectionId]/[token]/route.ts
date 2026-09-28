import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestShopifyOrder, type ShopifyOrderPayload } from "@/lib/shopify-channel/orders";

function tokenMatches(stored: string, given: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ connectionId: string; token: string }> }
) {
  const { connectionId, token } = await context.params;
  const connection = await db.shopifyConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.disconnectedAt || !tokenMatches(connection.webhookToken, token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = (await req.json()) as ShopifyOrderPayload;
  const test = req.headers.get("x-shopify-test") === "true";
  const street = payload.shipping_address?.address1;
  const name = payload.shipping_address?.name || payload.shipping_address?.first_name;
  if (street && name) {
    await db.shopifyConnection.update({
      where: { id: connection.id },
      data: { addressTestStatus: "PASSED", addressSource: "WEBHOOK" },
    });
  }
  if (!test && (payload.financial_status || "").toLowerCase() === "paid") {
    await ingestShopifyOrder(connection.id, payload);
  }
  return NextResponse.json({ ok: true });
}
