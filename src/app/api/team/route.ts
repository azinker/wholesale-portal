import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createMagicToken } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (!user?.wholesaleAccount) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = user.wholesaleAccount.id;

  const members = await db.teamMember.findMany({
    where: { accountId },
    include: {
      user: {
        select: { id: true, email: true, avatarKey: true },
      },
    },
    orderBy: { invitedAt: "asc" },
  });

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.wholesaleAccount) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = user.wholesaleAccount.id;

  // Check if current user is OWNER or ADMIN
  const currentMember = await db.teamMember.findUnique({
    where: { accountId_userId: { accountId, userId: user.id } },
  });

  // If no team member record, they're the account owner (legacy)
  const isOwnerOrAdmin =
    !currentMember ||
    currentMember.role === "OWNER" ||
    currentMember.role === "ADMIN";

  if (!isOwnerOrAdmin) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { email, role } = await req.json();

  if (!email || !role) {
    return NextResponse.json({ error: "Email and role required" }, { status: 400 });
  }

  // Prevent setting OWNER role (there can only be one)
  if (role === "OWNER") {
    return NextResponse.json({ error: "Cannot assign OWNER role" }, { status: 400 });
  }

  // Check if user already exists in the system
  let invitee = await db.portalUser.findUnique({ where: { email } });

  if (!invitee) {
    // Create a new portal user for the invitee
    invitee = await db.portalUser.create({
      data: { email },
    });
  }

  // Check if already a team member
  const existing = await db.teamMember.findUnique({
    where: { accountId_userId: { accountId, userId: invitee.id } },
  });

  if (existing) {
    return NextResponse.json({ error: "User is already a team member" }, { status: 409 });
  }

  // Create team member
  const member = await db.teamMember.create({
    data: {
      accountId,
      userId: invitee.id,
      role,
      invitedBy: user.email,
    },
  });

  // Send branded invite email
  try {
    const token = await createMagicToken(email);
    const appUrl = env().NEXT_PUBLIC_APP_URL;
    const loginUrl = `${appUrl}/api/auth/verify?token=${token}`;

    const { buildTeamInviteHtml } = await import("@/lib/email");
    const { html, text } = buildTeamInviteHtml(
      user.email,
      user.wholesaleAccount.companyName,
      role,
      loginUrl,
    );

    const { Resend } = await import("resend");
    const resend = new Resend(env().RESEND_API_KEY);

    await resend.emails.send({
      from: env().EMAIL_FROM,
      to: email,
      subject: `You've been invited to ${user.wholesaleAccount.companyName}'s wholesale team — The Perfect Part`,
      html,
      text,
    });
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }

  return NextResponse.json({ member });
}
