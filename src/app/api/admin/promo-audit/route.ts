import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { runPromoAudit } from "@/lib/promo-audit";

export async function POST() {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await runPromoAudit();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Promo audit error:", error);
    return NextResponse.json(
      { error: "Promo audit failed" },
      { status: 500 }
    );
  }
}
