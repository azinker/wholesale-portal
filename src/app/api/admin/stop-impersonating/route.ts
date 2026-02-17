import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "wsp_session";
const ADMIN_SESSION_COOKIE = "wsp_admin_session";

/**
 * POST /api/admin/stop-impersonating
 *
 * Restores the admin's original session from the saved cookie
 * and redirects back to admin.
 */
export async function POST() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!adminToken) {
    return NextResponse.json({ error: "No admin session to restore" }, { status: 400 });
  }

  // Restore the admin session
  cookieStore.set(SESSION_COOKIE, adminToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  // Remove the saved admin session cookie
  cookieStore.delete(ADMIN_SESSION_COOKIE);

  return NextResponse.json({ success: true, redirectTo: "/admin" });
}
