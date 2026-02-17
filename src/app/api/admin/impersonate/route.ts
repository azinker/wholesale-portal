import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";

const SESSION_COOKIE = "wsp_session";
const ADMIN_SESSION_COOKIE = "wsp_admin_session";
const SESSION_DAYS = 30;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/**
 * POST /api/admin/impersonate
 * Body: { userId: string }
 *
 * Saves the admin's current session token in a separate cookie,
 * then creates a new session as the target user.
 */
export async function POST(req: NextRequest) {
  const admin = await getUser();
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await req.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Verify the target user exists
  const targetUser = await db.portalUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Save current admin session cookie so we can restore it later
  const cookieStore = await cookies();
  const currentAdminToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (currentAdminToken) {
    cookieStore.set(ADMIN_SESSION_COOKIE, currentAdminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
  }

  // Create a new session for the target user
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: { userId: targetUser.id, expiresAt },
  });

  const token = await new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getJwtSecret());

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  // Audit log
  await db.auditLog.create({
    data: {
      actorEmail: admin.email,
      action: "admin_impersonate",
      details: {
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
      },
    },
  });

  return NextResponse.json({ success: true, redirectTo: "/dashboard" });
}
