import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { recalcTier } from "@/lib/tier-engine";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const result = await recalcTier(accountId);

    return NextResponse.json({
      success: true,
      previousTier: result.previousTier,
      newTier: result.newTier,
      count7d: result.count7d,
      changed: result.changed,
    });
  } catch (error) {
    console.error("Manual tier recalc error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to recalculate tier" },
      { status: 500 }
    );
  }
}
