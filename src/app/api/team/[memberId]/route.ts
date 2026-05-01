import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTeamMemberRemovedEmail, sendTeamMemberRoleChangedEmail } from "@/lib/email";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const user = await getUser();
  if (!user?.wholesaleAccount) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await params;
  const accountId = user.wholesaleAccount.id;

  // Verify requester is OWNER or ADMIN
  const currentMember = await db.teamMember.findUnique({
    where: { accountId_userId: { accountId, userId: user.id } },
  });

  const isOwnerOrAdmin =
    !currentMember ||
    currentMember.role === "OWNER" ||
    currentMember.role === "ADMIN";

  if (!isOwnerOrAdmin) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const target = await db.teamMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });
  if (!target || target.accountId !== accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cannot modify OWNER
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Cannot modify owner role" }, { status: 400 });
  }

  const { role } = await req.json();

  if (role === "OWNER") {
    return NextResponse.json({ error: "Cannot assign OWNER role" }, { status: 400 });
  }

  const updated = await db.teamMember.update({
    where: { id: memberId },
    data: { role },
  });

  if (target.role !== role) {
    const recipients = Array.from(new Set([user.wholesaleAccount.email, target.user.email]));
    await sendTeamMemberRoleChangedEmail(
      recipients,
      user.wholesaleAccount.companyName,
      target.user.email,
      target.role,
      role,
      user.email
    );
  }

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const user = await getUser();
  if (!user?.wholesaleAccount) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await params;
  const accountId = user.wholesaleAccount.id;

  // Verify requester is OWNER or ADMIN
  const currentMember = await db.teamMember.findUnique({
    where: { accountId_userId: { accountId, userId: user.id } },
  });

  const isOwnerOrAdmin =
    !currentMember ||
    currentMember.role === "OWNER" ||
    currentMember.role === "ADMIN";

  if (!isOwnerOrAdmin) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const target = await db.teamMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });
  if (!target || target.accountId !== accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cannot remove OWNER
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
  }

  await db.teamMember.delete({ where: { id: memberId } });

  const recipients = Array.from(new Set([user.wholesaleAccount.email, target.user.email]));
  await sendTeamMemberRemovedEmail(
    recipients,
    user.wholesaleAccount.companyName,
    target.user.email,
    user.email
  );

  return NextResponse.json({ success: true });
}
