import { NextRequest, NextResponse } from "next/server";
import { recalcAllTiers } from "@/lib/tier-engine";
import { runAllRiskChecks } from "@/lib/risk-detection";

/**
 * POST /api/cron/tier-recalc
 *
 * Recalculates tiers for all approved wholesale accounts.
 * Call this from a Vercel Cron or external scheduler.
 *
 * Protected by a simple bearer token (CRON_SECRET env var).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const start = Date.now();
    const result = await recalcAllTiers();
    const riskResult = await runAllRiskChecks().catch((err) => {
      console.error("Risk checks failed during cron:", err);
      return { processed: 0, flagsCreated: 0, errors: 1 };
    });
    const elapsed = Date.now() - start;

    console.log(
      `Tier recalc complete: ${result.processed} processed, ${result.changed} changed, ${result.errors} errors (${elapsed}ms)`
    );
    console.log(
      `Risk checks: ${riskResult.processed} accounts, ${riskResult.flagsCreated} flags, ${riskResult.errors} errors`
    );

    return NextResponse.json({
      ...result,
      riskChecks: riskResult,
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
