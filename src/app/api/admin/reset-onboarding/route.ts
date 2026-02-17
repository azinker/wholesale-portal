import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const account = await db.wholesaleAccount.findUnique({
      where: { id: accountId },
      select: { id: true, companyName: true, email: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Reset onboarding flags and dismissed state
    // Does NOT touch documents (resale certs stay intact)
    await db.wholesaleAccount.update({
      where: { id: accountId },
      data: {
        onboardingDismissed: false,
        onboardingFlags: {},
      },
    });

    // Audit log entry
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "admin_reset_onboarding",
        targetAccountId: accountId,
        details: {
          companyName: account.companyName,
          email: account.email,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset onboarding error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset onboarding" },
      { status: 500 }
    );
  }
}
