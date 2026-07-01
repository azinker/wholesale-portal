import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processWebhookEvent } from "@/lib/bigcommerce/webhooks";

const STALE_MS = 15 * 60 * 1000;

function authorizeCron(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Retry webhook events stuck in PROCESSING after the serverless function returned 200. */
export async function GET(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await db.webhookEvent.findMany({
    where: {
      status: "PROCESSING",
      receivedAt: { lt: cutoff },
    },
    orderBy: { receivedAt: "asc" },
    take: 20,
  });

  const results = [];
  for (const event of stale) {
    const payload = event.payload as {
      scope?: string;
      data?: Record<string, unknown>;
    };
    try {
      await processWebhookEvent(
        event.id,
        payload.scope || event.type,
        payload.data || {}
      );
      results.push({ id: event.id, type: event.type, status: "retried" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: event.id, type: event.type, status: "failed", error: message });
    }
  }

  return NextResponse.json({ retried: results.length, results });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
