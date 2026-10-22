import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";

/** Shopify app-review sign-in. Magic links go to this inbox, which the reviewer cannot open. */
const REVIEW_EMAIL = "azforcefed@gmail.com";

const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_LIMIT = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function reviewPassword(): string | null {
  const password = process.env.SHOPIFY_REVIEW_PASSWORD?.trim();
  return password ? password : null;
}

function sameSecret(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function allowedAttempt(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return true;
  }
  if (entry.count >= ATTEMPT_LIMIT) return false;
  entry.count += 1;
  return true;
}

async function signInReviewer() {
  const user = await db.portalUser.findUnique({ where: { email: REVIEW_EMAIL } });
  if (!user) return null;
  await createSession(user.id);
  return user;
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function GET(req: NextRequest) {
  const expected = reviewPassword();
  const key = req.nextUrl.searchParams.get("key")?.trim() || "";
  if (!expected || !allowedAttempt(clientIp(req)) || !sameSecret(key, expected)) {
    return NextResponse.redirect(appUrl("/login/review?error=invalid"));
  }
  const user = await signInReviewer();
  if (!user) return NextResponse.redirect(appUrl("/login/review?error=invalid"));
  return NextResponse.redirect(appUrl("/my-shopify"));
}

export async function POST(req: NextRequest) {
  const expected = reviewPassword();
  if (!expected || !allowedAttempt(clientIp(req))) {
    return NextResponse.redirect(appUrl("/login/review?error=invalid"));
  }

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "").trim();
  if (email !== REVIEW_EMAIL || !sameSecret(password, expected)) {
    return NextResponse.redirect(appUrl("/login/review?error=invalid"));
  }

  const user = await signInReviewer();
  if (!user) return NextResponse.redirect(appUrl("/login/review?error=invalid"));
  return NextResponse.redirect(appUrl("/my-shopify"));
}
