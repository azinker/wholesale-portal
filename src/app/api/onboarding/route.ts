import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const user = await getUser();
  if (!user?.wholesaleAccount) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.wholesaleAccount.update({
    where: { id: user.wholesaleAccount.id },
    data: { onboardingDismissed: true },
  });

  return NextResponse.json({ success: true });
}
