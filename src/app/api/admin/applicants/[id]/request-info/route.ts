import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { sendApplicantMoreInfoRequestEmail } from "@/lib/email";

const requestInfoSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
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
    const { message } = requestInfoSchema.parse(body);

    const account = await db.wholesaleAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (account.status !== "PENDING" && account.status !== "RETAIL") {
      return NextResponse.json(
        { error: "More information can only be requested for an open application" },
        { status: 400 }
      );
    }

    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "applicant_more_info_requested",
        targetCustomerId: account.customerId,
        targetAccountId: account.id,
        details: {
          companyName: account.companyName,
          message,
        },
      },
    });

    await sendApplicantMoreInfoRequestEmail(account.email, account.companyName, message);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    console.error("Request info error:", error);
    return NextResponse.json(
      { error: "Failed to request more information" },
      { status: 500 }
    );
  }
}
