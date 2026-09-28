import { NextRequest, NextResponse } from "next/server";
import { drainQueuedChannelOrders, remindStaleCardAttention } from "@/lib/shopify-channel/orders";
import { runNextPublishJob, syncListingInventory } from "@/lib/shopify-channel/publish";

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

export async function GET(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;
  const published = await runNextPublishJob();
  const inventory = await syncListingInventory();
  const queued = await drainQueuedChannelOrders();
  const reminded = await remindStaleCardAttention();
  return NextResponse.json({ published, inventory, queued, reminded });
}
