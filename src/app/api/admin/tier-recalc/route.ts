import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { recalcTier, recalcAllTiers } from "@/lib/tier-engine";
import {
  recalcAllPublisherTiers,
  recalcPublisherTier,
} from "@/lib/publisher-tier-engine";
import { db } from "@/lib/db";

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
      const account = await db.wholesaleAccount.findUnique({
        where: { id: accountId },
        select: { partnerType: true },
      });
      const result =
        account?.partnerType === "AFFILIATE_PUBLISHER"
          ? await recalcPublisherTier(accountId)
          : await recalcTier(accountId);
      return NextResponse.json(result);
    }

    const result = await recalcAllTiers();
    const publishers = await recalcAllPublisherTiers();
    return NextResponse.json({ dropshippers: result, publishers });
  } catch (error) {
    console.error("Admin tier recalc error:", error);
    return NextResponse.json(
      { error: "Tier recalculation failed" },
      { status: 500 }
    );
  }
}
