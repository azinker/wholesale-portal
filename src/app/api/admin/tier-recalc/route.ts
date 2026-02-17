import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { recalcTier, recalcAllTiers } from "@/lib/tier-engine";

/**
 * POST /api/admin/tier-recalc
 *
 * Admin-triggered tier recalculation.
 * Body: { accountId?: string } — if provided, recalc single account; otherwise, recalc all.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId as string | undefined;

    if (accountId) {
      const result = await recalcTier(accountId);
      return NextResponse.json(result);
    }

    const result = await recalcAllTiers();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin tier recalc error:", error);
    return NextResponse.json(
      { error: "Tier recalculation failed" },
      { status: 500 }
    );
  }
}
