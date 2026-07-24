import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { sendApplicantDenialEmail, sendPublisherDenialEmail } from "@/lib/email";

const denySchema = z.object({
  reason: z.string().min(1, "Denial reason is required").max(2000, "Denial reason is too long"),
});

export async function POST(
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
    const { reason } = denySchema.parse(body);

    const account = await db.wholesaleAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (account.status === "DENIED") {
      return NextResponse.json({ error: "Already denied" }, { status: 400 });
    }

    if (account.status !== "PENDING" && account.status !== "RETAIL") {
      return NextResponse.json(
        { error: "Only pending applications can be denied" },
        { status: 400 }
      );
    }

    // Update account
    await db.wholesaleAccount.update({
      where: { id },
      data: {
        status: "DENIED",
        denialReason: reason,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "applicant_denied",
        targetCustomerId: account.customerId,
        targetAccountId: account.id,
        details: {
          companyName: account.companyName,
          reason,
        },
      },
    });

    if (account.partnerType === "AFFILIATE_PUBLISHER") {
      await sendPublisherDenialEmail(account.email, account.companyName, reason);
    } else {
      await sendApplicantDenialEmail(account.email, account.companyName, reason);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    console.error("Deny error:", error);
    return NextResponse.json(
      { error: "Failed to deny applicant" },
      { status: 500 }
    );
  }
}
