import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";

/** PATCH /api/admin/risk-flags/[id] — resolve a risk flag */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const status = body.status as string;

    if (!["CLEARED", "KEPT"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be CLEARED or KEPT." },
        { status: 400 }
      );
    }

    const flag = await db.riskFlag.findUnique({ where: { id } });
    if (!flag) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (flag.status !== "OPEN") {
      return NextResponse.json({ error: "Flag is already resolved" }, { status: 409 });
    }

    await db.riskFlag.update({
      where: { id },
      data: {
        status: status as "CLEARED" | "KEPT",
        clearedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: `risk_flag_${status.toLowerCase()}`,
        targetAccountId: flag.accountId,
        details: { flagId: id, flagType: flag.type },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Risk flag resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve risk flag" },
      { status: 500 }
    );
  }
}
