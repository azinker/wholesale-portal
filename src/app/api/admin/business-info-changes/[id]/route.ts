import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";

/** POST: Approve or deny a business info change request */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, reviewNote } = body as { action: "approve" | "deny"; reviewNote?: string };

  if (!["approve", "deny"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const changeRequest = await db.businessInfoChange.findUnique({
    where: { id },
    include: { account: true },
  });

  if (!changeRequest) {
    return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  }

  if (changeRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Change request already reviewed" }, { status: 409 });
  }

  if (action === "approve") {
    // Apply changes to the wholesale account
    const newValues = changeRequest.newValues as Record<string, string>;
    const updateData: Record<string, string> = {};

    for (const [key, value] of Object.entries(newValues)) {
      updateData[key] = value;
    }

    await db.$transaction([
      db.wholesaleAccount.update({
        where: { id: changeRequest.accountId },
        data: updateData,
      }),
      db.businessInfoChange.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedBy: user.email,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
        },
      }),
      db.auditLog.create({
        data: {
          actorEmail: user.email,
          action: "business_info_change_approved",
          targetAccountId: changeRequest.accountId,
          details: { changeRequestId: id, appliedFields: Object.keys(newValues) },
        },
      }),
    ]);
  } else {
    await db.$transaction([
      db.businessInfoChange.update({
        where: { id },
        data: {
          status: "DENIED",
          reviewedBy: user.email,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
        },
      }),
      db.auditLog.create({
        data: {
          actorEmail: user.email,
          action: "business_info_change_denied",
          targetAccountId: changeRequest.accountId,
          details: { changeRequestId: id, reason: reviewNote },
        },
      }),
    ]);
  }

  return NextResponse.json({ success: true, status: action === "approve" ? "APPROVED" : "DENIED" });
}
