import { NextRequest, NextResponse } from "next/server";
import { createMagicToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

// Simple in-memory rate limit (per email, 5 requests per 5 minutes)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 5 * 60 * 1000;

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Handle both form submissions and JSON
    const contentType = req.headers.get("content-type") || "";
    let email: string;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      email = (formData.get("email") as string)?.trim().toLowerCase();
    } else {
      const body = await req.json();
      email = body.email?.trim().toLowerCase();
    }

    if (!email || !email.includes("@")) {
      return NextResponse.redirect(
        new URL("/?error=invalid_email", req.url)
      );
    }

    // Rate limit check
    if (!checkRateLimit(email)) {
      return NextResponse.redirect(
        new URL("/?error=rate_limited", req.url)
      );
    }

    // Create and send magic link
    const token = await createMagicToken(email);
    await sendMagicLink(email, token);

    return NextResponse.redirect(
      new URL("/?sent=true", req.url)
    );
  } catch (error) {
    console.error("Magic link error:", error);
    return NextResponse.redirect(
      new URL("/?error=send_failed", req.url)
    );
  }
}
