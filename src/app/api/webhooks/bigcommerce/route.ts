import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processWebhookEvent } from "@/lib/bigcommerce/webhooks";
import { verifyBigCommerceWebhookSignature } from "@/lib/bigcommerce/verify-webhook";

/**
 * BigCommerce webhook receiver.
 * BC sends POST with JSON body: { scope, store_id, data, hash, created_at, producer }
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-bc-signature");

    if (process.env.NODE_ENV === "production") {
      if (!verifyBigCommerceWebhookSignature(rawBody, signature)) {
        console.warn("BigCommerce webhook rejected: invalid or missing signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (signature && !verifyBigCommerceWebhookSignature(rawBody, signature)) {
      console.warn("BigCommerce webhook signature mismatch (dev — allowing for testing)");
    }

    const body = JSON.parse(rawBody) as {
      scope?: string;
      data?: Record<string, unknown>;
      hash?: string;
      created_at?: number;
    };
    const { scope, data } = body;

    const event = await db.webhookEvent.create({
      data: {
        type: scope || "unknown",
        payload: JSON.parse(rawBody),
        status: "RECEIVED",
      },
    });

    processWebhookEvent(event.id, scope || "unknown", data || {}).catch((err) => {
      console.error(`Webhook processing failed for ${event.id}:`, err);
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
