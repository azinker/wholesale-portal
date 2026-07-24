import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { loadWelcomeConfig, recalcTier } from "@/lib/tier-engine";
import { Prisma } from "@prisma/client";

/**
 * POST /api/admin/reset-welcome
 *
 * Resets the welcome discount for a wholesale account to a fresh window
 * starting from now. Uses the currently configured welcome discount duration.
 * Also triggers a tier recalc so the WELCOME tier activates immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const account = await db.wholesaleAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        companyName: true,
        email: true,
        customerId: true,
        welcomeExpiresAt: true,
        partnerType: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (account.partnerType === "AFFILIATE_PUBLISHER") {
      return NextResponse.json(
        { error: "Welcome discounts are only available to dropshippers" },
        { status: 400 }
      );
    }

    const welcomeCfg = await loadWelcomeConfig();
    const newExpiry = new Date(Date.now() + welcomeCfg.hours * 60 * 60 * 1000);

    await db.wholesaleAccount.update({
      where: { id: accountId },
      data: { welcomeExpiresAt: newExpiry },
    });

    // Recalc tier immediately so WELCOME discount activates right away
    await recalcTier(accountId);

    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "admin_reset_welcome",
        targetAccountId: accountId,
        targetCustomerId: account.customerId ?? undefined,
        details: {
          companyName: account.companyName,
          email: account.email,
          previousExpiry: account.welcomeExpiresAt?.toISOString() ?? null,
          newExpiry: newExpiry.toISOString(),
          hours: welcomeCfg.hours,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      newExpiry: newExpiry.toISOString(),
      hours: welcomeCfg.hours,
    });
  } catch (error) {
    console.error("Reset welcome error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset welcome bonus" },
      { status: 500 }
    );
  }
}
