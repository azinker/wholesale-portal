import { NextRequest, NextResponse } from "next/server";
import { recalcAllTiers } from "@/lib/tier-engine";

/**
 * POST /api/cron/tier-recalc
 *
 * Recalculates tiers for all approved wholesale accounts.
 * Call this from a Vercel Cron or external scheduler.
 *
 * Protected by a simple bearer token (CRON_SECRET env var).
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.JWT_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "No cron secret configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.log(`[cron-auth] FAIL — header len: ${authHeader?.length ?? "null"}, secret len: ${cronSecret.length}, header prefix: "${authHeader?.slice(0, 10)}", secret source: ${process.env.CRON_SECRET ? "CRON_SECRET" : "JWT_SECRET"}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const start = Date.now();
    const result = await recalcAllTiers();
    const elapsed = Date.now() - start;

    console.log(
      `Tier recalc complete: ${result.processed} processed, ${result.changed} changed, ${result.errors} errors (${elapsed}ms)`
    );

    return NextResponse.json({
      ...result,
      elapsedMs: elapsed,
    });
  } catch (error) {
    console.error("Tier recalc cron error:", error);
    return NextResponse.json(
      { error: "Tier recalculation failed" },
      { status: 500 }
    );
  }
}

/** Also support GET for Vercel Cron jobs (they send GET) */
export async function GET(req: NextRequest) {
  return POST(req);
}
