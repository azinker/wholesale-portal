import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { ensurePromoForTier, getTierConfig, loadTierWindowDays, loadTiers, type TierId } from "@/lib/tier-engine";
import { sendCouponChangedEmail, sendTierChangedEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { tier, locked } = body as { tier: TierId; locked: boolean };

    // Validate tier against dynamic config
    const tiers = await loadTiers();
    const validTierIds = ["NONE", ...tiers.map((t) => t.id)];

    if (!validTierIds.includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    // Fetch the account
    const account = await db.wholesaleAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved accounts can have tier overrides" },
        { status: 400 }
      );
    }

    const previousTier = account.lastTier as TierId;

    // Update the account
    await db.wholesaleAccount.update({
      where: { id },
      data: {
        lastTier: tier,
        pausedUpgrades: locked,
      },
    });

    // Always ensure the correct promotion exists and is enabled for this tier.
    // This handles both tier changes and cases where the BC promo failed previously.
    await ensurePromoForTier(id, account.alias, tier);

    if (previousTier !== tier) {
      const previousConfig = await getTierConfig(previousTier);
      const newConfig = await getTierConfig(tier);
      const windowDays = await loadTierWindowDays();
      const previousDiscount = previousConfig?.discount ?? 0;
      const newDiscount = newConfig?.discount ?? 0;
      await sendTierChangedEmail(
        account.email,
        account.companyName,
        previousTier,
        tier,
        account.lastCount7d,
        windowDays,
        newDiscount >= previousDiscount ? "achieved" : "downgraded"
      );

      if (previousTier !== "NONE" && tier !== "NONE" && newConfig) {
        const activePromo = await db.promotionRecord.findFirst({
          where: { accountId: id, enabled: true, tier },
          select: { code: true },
        });
        if (activePromo) {
          await sendCouponChangedEmail(
            account.email,
            account.companyName,
            previousTier,
            tier,
            activePromo.code,
            newConfig.discount
          );
        }
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "tier_override",
        targetAccountId: id,
        targetCustomerId: account.customerId,
        details: {
          previousTier,
          newTier: tier,
          locked,
          manual: true,
        },
      },
    });

    return NextResponse.json({
      success: true,
      previousTier,
      newTier: tier,
      locked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
