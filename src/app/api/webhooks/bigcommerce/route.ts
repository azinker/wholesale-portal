import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processWebhookEvent } from "@/lib/bigcommerce/webhooks";

/**
 * BigCommerce webhook receiver.
 * BC sends POST with JSON body: { scope, store_id, data, hash, created_at, producer }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scope, data, hash, created_at } = body;

    // Store the raw event
    const event = await db.webhookEvent.create({
      data: {
        type: scope || "unknown",
        payload: body,
        status: "RECEIVED",
      },
    });

    // Process async (don't block the response)
    processWebhookEvent(event.id, scope, data).catch((err) => {
      console.error(`Webhook processing failed for ${event.id}:`, err);
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
