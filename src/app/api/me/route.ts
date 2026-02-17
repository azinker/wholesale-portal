import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/** Lightweight endpoint returning the current session user's email. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ email: null }, { status: 401 });
  }
  return NextResponse.json({ email: user.email });
}
