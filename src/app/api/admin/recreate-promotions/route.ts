import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { ensurePromoForTier } from "@/lib/tier-engine";

/**
 * POST /api/admin/recreate-promotions
 *
 * Force-recreates all promotions by clearing promoIds and re-running ensurePromoForTier.
 * Use this when promotions were deleted in BigCommerce but still exist in the database.
 *
 * Body: { accountId?: string } — if provided, recreate for single account; otherwise, all accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const accountId = body.accountId as string | undefined;

    let accounts;
    if (accountId) {
      const account = await db.wholesaleAccount.findUnique({
        where: { id: accountId, status: "APPROVED" },
        select: { id: true, alias: true, lastTier: true },
      });
      accounts = account ? [account] : [];
    } else {
      accounts = await db.wholesaleAccount.findMany({
        where: { status: "APPROVED" },
        select: { id: true, alias: true, lastTier: true },
      });
    }

    let processed = 0;
    let recreated = 0;
    let errors = 0;

    for (const account of accounts) {
      try {
        // Clear promoId from all promotion records for this account
        // This forces ensurePromoForTier to recreate them in BigCommerce
        await db.promotionRecord.updateMany({
          where: { accountId: account.id },
          data: { promoId: null, enabled: false },
        });

        // Re-run promotion creation
        await ensurePromoForTier(account.id, account.alias, account.lastTier as string);

        processed++;
        if (account.lastTier !== "NONE") {
          recreated++;
        }
      } catch (err) {
        errors++;
        console.error(`Failed to recreate promotion for ${account.id}:`, err);
      }
    }

    return NextResponse.json({ processed, recreated, errors });
  } catch (error) {
    console.error("Promotion recreation error:", error);
    return NextResponse.json(
      { error: "Promotion recreation failed" },
      { status: 500 }
    );
  }
}
