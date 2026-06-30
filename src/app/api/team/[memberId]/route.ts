import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccount, type PortalUser } from "@/lib/portal-auth";
import { db } from "@/lib/db";
import { sendTeamMemberRemovedEmail, sendTeamMemberRoleChangedEmail } from "@/lib/email";

const roleSchema = z.object({
  role: z.enum(["ADMIN", "PURCHASER", "VIEWER"]),
});

async function assertOwnerOrAdmin(user: PortalUser) {
  const accountId = user.wholesaleAccount!.id;
  const currentMember = await db.teamMember.findUnique({
    where: { accountId_userId: { accountId, userId: user.id } },
  });
  const isOwnerOrAdmin =
    user.isAccountOwner || currentMember?.role === "ADMIN";
  return isOwnerOrAdmin;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const auth = await requirePortalAccount("manage_team");
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = auth.user;

  if (!(await assertOwnerOrAdmin(user))) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { memberId } = await params;
  const accountId = user.wholesaleAccount!.id;

  const target = await db.teamMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });
  if (!target || target.accountId !== accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Cannot modify owner role" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { role } = parsed.data;

  const updated = await db.teamMember.update({
    where: { id: memberId },
    data: { role },
  });

  if (target.role !== role) {
    const recipients = Array.from(new Set([user.wholesaleAccount!.email, target.user.email]));
    await sendTeamMemberRoleChangedEmail(
      recipients,
      user.wholesaleAccount!.companyName,
      target.user.email,
      target.role,
      role,
      user.email
    );
  }

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const auth = await requirePortalAccount("manage_team");
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = auth.user;

  if (!(await assertOwnerOrAdmin(user))) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { memberId } = await params;
  const accountId = user.wholesaleAccount!.id;

  const target = await db.teamMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });
  if (!target || target.accountId !== accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
  }

  await db.teamMember.delete({ where: { id: memberId } });

  const recipients = Array.from(new Set([user.wholesaleAccount!.email, target.user.email]));
  await sendTeamMemberRemovedEmail(
    recipients,
    user.wholesaleAccount!.companyName,
    target.user.email,
    user.email
  );

  return NextResponse.json({ success: true });
}
