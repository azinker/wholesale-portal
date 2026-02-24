import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { recalcTier } from "@/lib/tier-engine";

/**
 * POST /api/admin/remove-welcome
 *
 * Removes welcome discount eligibility immediately for an account, then
 * recalculates the earned tier from current rolling-window order volume.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { accountId } = body as { accountId?: string };
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
      },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await db.wholesaleAccount.update({
      where: { id: accountId },
      data: { welcomeExpiresAt: null },
    });

    const result = await recalcTier(accountId, { ignorePausedUpgrades: true });

    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "admin_remove_welcome",
        targetAccountId: accountId,
        targetCustomerId: account.customerId ?? undefined,
        details: {
          companyName: account.companyName,
          email: account.email,
          previousExpiry: account.welcomeExpiresAt?.toISOString() ?? null,
          newExpiry: null,
          previousTier: result.previousTier,
          newTier: result.newTier,
          count7d: result.count7d,
          windowDays: result.windowDays,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      previousTier: result.previousTier,
      newTier: result.newTier,
      count7d: result.count7d,
      windowDays: result.windowDays,
    });
  } catch (error) {
    console.error("Remove welcome error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove welcome bonus" },
      { status: 500 }
    );
  }
}
