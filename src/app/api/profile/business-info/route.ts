import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

const EDITABLE_FIELDS = [
  "companyName",
  "legalName",
  "phone",
  "businessAddress",
  "primaryState",
  "website",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

/** POST: Submit a business info change request */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = user.wholesaleAccount;
  if (!account) {
    return NextResponse.json({ error: "No wholesale account found" }, { status: 400 });
  }

  // Check for existing pending request
  const existingPending = await db.businessInfoChange.findFirst({
    where: { accountId: account.id, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a pending change request. Please wait for it to be reviewed." },
      { status: 409 }
    );
  }

  const body = await req.json();
  const { changes } = body as { changes: Record<string, string> };

  if (!changes || typeof changes !== "object") {
    return NextResponse.json({ error: "Invalid changes payload" }, { status: 400 });
  }

  // Filter to only allowed fields and only actual changes
  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string> = {};

  for (const key of Object.keys(changes)) {
    if (!EDITABLE_FIELDS.includes(key as EditableField)) continue;

    const currentValue = account[key as EditableField] ?? "";
    const newValue = (changes[key] || "").trim();

    if (currentValue !== newValue) {
      oldValues[key] = currentValue || null;
      newValues[key] = newValue;
    }
  }

  if (Object.keys(newValues).length === 0) {
    return NextResponse.json({ error: "No changes detected" }, { status: 400 });
  }

  const changeRequest = await db.businessInfoChange.create({
    data: {
      accountId: account.id,
      oldValues,
      newValues,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      actorEmail: user.email,
      action: "business_info_change_requested",
      targetAccountId: account.id,
      details: { changeRequestId: changeRequest.id, fields: Object.keys(newValues) },
    },
  });

  return NextResponse.json({ success: true, id: changeRequest.id });
}
