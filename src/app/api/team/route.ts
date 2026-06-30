import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccount } from "@/lib/portal-auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createMagicToken } from "@/lib/auth";
import { sendTeamMemberAddedEmail } from "@/lib/email";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "PURCHASER", "VIEWER"]),
});

export async function GET() {
  const auth = await requirePortalAccount();
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = auth.user;

  const accountId = user.wholesaleAccount!.id;

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
  const auth = await requirePortalAccount("manage_team");
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const user = auth.user;

  const accountId = user.wholesaleAccount!.id;

  // Account owners have no teamMember row; invited admins do
  const currentMember = await db.teamMember.findUnique({
    where: { accountId_userId: { accountId, userId: user.id } },
  });

  const isOwnerOrAdmin =
    user.isAccountOwner ||
    currentMember?.role === "ADMIN";

  if (!isOwnerOrAdmin) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  let invitee = await db.portalUser.findUnique({ where: { email } });

  if (!invitee) {
    invitee = await db.portalUser.create({
      data: { email },
    });
  }

  const existing = await db.teamMember.findUnique({
    where: { accountId_userId: { accountId, userId: invitee.id } },
  });

  if (existing) {
    return NextResponse.json({ error: "User is already a team member" }, { status: 409 });
  }

  const member = await db.teamMember.create({
    data: {
      accountId,
      userId: invitee.id,
      role,
      invitedBy: user.email,
    },
  });

  try {
    const token = await createMagicToken(email);
    const appUrl = env().NEXT_PUBLIC_APP_URL;
    const loginUrl = `${appUrl}/api/auth/verify?token=${token}`;

    const { buildTeamInviteHtml } = await import("@/lib/email");
    const { html, text } = buildTeamInviteHtml(
      user.email,
      user.wholesaleAccount!.companyName,
      role,
      loginUrl,
    );

    const { Resend } = await import("resend");
    const resend = new Resend(env().RESEND_API_KEY);

    await resend.emails.send({
      from: env().EMAIL_FROM,
      to: email,
      subject: `You've been invited to ${user.wholesaleAccount!.companyName}'s wholesale team — The Perfect Part`,
      html,
      text,
    });
  } catch (err) {
    console.error("Failed to send invite email:", err);
    return NextResponse.json(
      { error: "Member added but invite email failed to send", member },
      { status: 502 }
    );
  }

  await sendTeamMemberAddedEmail(
    user.wholesaleAccount!.email,
    user.wholesaleAccount!.companyName,
    email,
    role,
    user.email
  );

  return NextResponse.json({ member });
}
