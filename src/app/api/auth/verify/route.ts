import { NextRequest, NextResponse } from "next/server";
import { verifyMagicToken, createSession } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
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

  let user = await db.portalUser.findUnique({ where: { email } });

  if (!user) {
    user = await db.portalUser.create({
      data: { email },
    });
  }

  await createSession(user.id);

  // Mark team membership as accepted on first login
  await db.teamMember.updateMany({
    where: { userId: user.id, acceptedAt: null },
    data: { acceptedAt: new Date() },
  });

  if (isAdmin(email)) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
