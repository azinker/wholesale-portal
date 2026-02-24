import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { recalcTier } from "@/lib/tier-engine";

/** Minimum time between recalc attempts per account (ms) */
const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * GET /api/portal/tier-recalc
 *
 * Recalculates tier for the current portal user's wholesale account.
 * Used when an approved customer loads the dashboard so qualifying order
 * count is up to date. Rate-limited to once per 15 minutes per account.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = user.wholesaleAccount;
  if (!account || account.status !== "APPROVED") {
    return NextResponse.json({ skipped: true, reason: "no_approved_account" });
  }

  // Rate limit: skip if we have a recent tier snapshot for this account
  const latest = await db.tierSnapshot.findFirst({
    where: { accountId: account.id },
    orderBy: { asOf: "desc" },
    select: { asOf: true },
  });
  if (latest && Date.now() - latest.asOf.getTime() < RATE_LIMIT_MS) {
    return NextResponse.json({
      skipped: true,
      reason: "rate_limited",
      nextAllowedAfter: new Date(latest.asOf.getTime() + RATE_LIMIT_MS).toISOString(),
    });
  }

  try {
    const result = await recalcTier(account.id);
    return NextResponse.json({
      skipped: false,
      previousTier: result.previousTier,
      newTier: result.newTier,
      count7d: result.count7d,
      changed: result.changed,
      windowDays: result.windowDays,
    });
  } catch (err) {
    console.error("Portal tier recalc error:", err);
    return NextResponse.json(
      { error: "Tier recalculation failed" },
      { status: 500 }
    );
  }
}
