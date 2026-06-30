import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { sendBusinessInfoChangeReviewedEmail } from "@/lib/email";
import { filterEditableBusinessFields } from "@/lib/business-info-fields";

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
    const newValues = filterEditableBusinessFields(
      changeRequest.newValues as Record<string, unknown>
    );
    const fields = Object.keys(newValues);

    if (fields.length === 0) {
      return NextResponse.json({ error: "No valid fields to apply" }, { status: 400 });
    }

    await db.$transaction([
      db.wholesaleAccount.update({
        where: { id: changeRequest.accountId },
        data: newValues,
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
          details: { changeRequestId: id, appliedFields: fields },
        },
      }),
    ]);

    if (changeRequest.account.customerId) {
      try {
        const bcUpdate: {
          company?: string;
          phone?: string;
        } = {};
        if (newValues.companyName) bcUpdate.company = newValues.companyName;
        if (newValues.phone) bcUpdate.phone = newValues.phone;
        if (Object.keys(bcUpdate).length > 0) {
          await bc().updateCustomerProfile(changeRequest.account.customerId, bcUpdate);
        }
      } catch (err) {
        console.error("Failed to sync business info to BigCommerce:", err);
      }
    }

    await sendBusinessInfoChangeReviewedEmail(
      changeRequest.account.email,
      changeRequest.account.companyName,
      "APPROVED",
      fields,
      reviewNote
    );
  } else {
    const newValues = changeRequest.newValues as Record<string, string>;
    const fields = Object.keys(newValues);

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

    await sendBusinessInfoChangeReviewedEmail(
      changeRequest.account.email,
      changeRequest.account.companyName,
      "DENIED",
      fields,
      reviewNote
    );
  }

  return NextResponse.json({ success: true, status: action === "approve" ? "APPROVED" : "DENIED" });
}
