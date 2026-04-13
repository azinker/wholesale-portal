import { NextRequest, NextResponse } from "next/server";
import { verifyMagicToken, createSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  const email = await verifyMagicToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  // Find or create portal user
  let user = await db.portalUser.findUnique({ where: { email } });

  if (!user) {
    user = await db.portalUser.create({
      data: { email },
    });
  }

  // Create session
  await createSession(user.id);

  // Redirect: admin goes to /admin, everyone else to /dashboard
  const adminList = (process.env.ADMIN_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (adminList.includes(email.toLowerCase())) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
