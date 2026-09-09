import { NextRequest, NextResponse } from "next/server";
import { verifyMagicToken, createSession } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(appUrl("/login?error=missing_token"));
  }

  const email = await verifyMagicToken(token);
  if (!email) {
    return NextResponse.redirect(appUrl("/login?error=invalid_token"));
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
    return NextResponse.redirect(appUrl("/admin"));
  }

  return NextResponse.redirect(appUrl("/dashboard"));
}
