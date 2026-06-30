import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { TeamRole, WholesaleAccount } from "@prisma/client";
import { db } from "./db";
import { getAvatarUrl } from "./avatar";

const SESSION_COOKIE = "wsp_session";
const ADMIN_SESSION_COOKIE = "wsp_admin_session";
const SESSION_DAYS = 30;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Create a magic-link token (short-lived, 15 min) */
export async function createMagicToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: "magic-link" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getJwtSecret());
}

/** Verify a magic-link token and return the email */
export async function verifyMagicToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.purpose !== "magic-link" || typeof payload.email !== "string") {
      return null;
    }
    return payload.email;
  } catch {
    return null;
  }
}

/** Create a session for a user and set the cookie */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await db.session.create({
    data: { userId, expiresAt },
  });

  const token = await new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  // Clear any stale admin impersonation cookie so the banner doesn't
  // appear with the wrong email after a direct magic-link login.
  if (cookieStore.get(ADMIN_SESSION_COOKIE)?.value) {
    cookieStore.delete(ADMIN_SESSION_COOKIE);
  }
}

function resolveAccountContext(user: {
  wholesaleAccount: WholesaleAccount | null;
  teamMemberships: Array<{ role: TeamRole; account: WholesaleAccount }>;
}): {
  wholesaleAccount: WholesaleAccount | null;
  teamRole: TeamRole | null;
  isAccountOwner: boolean;
} {
  if (user.wholesaleAccount) {
    return {
      wholesaleAccount: user.wholesaleAccount,
      teamRole: null,
      isAccountOwner: true,
    };
  }

  const membership = user.teamMemberships[0];
  if (membership) {
    return {
      wholesaleAccount: membership.account,
      teamRole: membership.role,
      isAccountOwner: false,
    };
  }

  return {
    wholesaleAccount: null,
    teamRole: null,
    isAccountOwner: false,
  };
}

/** Get the current authenticated user from the session cookie */
export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.sessionId !== "string") return null;

    const session = await db.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          include: {
            wholesaleAccount: true,
            teamMemberships: {
              include: { account: true },
              orderBy: { invitedAt: "asc" },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    const user = session.user;
    const { wholesaleAccount, teamRole, isAccountOwner } = resolveAccountContext(user);
    const linkedCustomerId =
      user.linkedCustomerId ?? wholesaleAccount?.customerId ?? null;

    const avatarUrl = await getAvatarUrl(user.avatarKey);

    return {
      ...user,
      wholesaleAccount,
      teamRole,
      isAccountOwner,
      linkedCustomerId,
      avatarUrl,
    };
  } catch {
    return null;
  }
}

/** Destroy the current session */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      if (typeof payload.sessionId === "string") {
        await db.session.delete({ where: { id: payload.sessionId } }).catch(() => {});
      }
    } catch {
      // Token invalid, just clear cookie
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}
