import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalAccount("view_channel");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });
  }
  if (!(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const { id } = await context.params;
  const job = await db.catalogExport.findFirst({
    where: { id, accountId: auth.user.wholesaleAccount.id },
    select: { id: true, status: true, total: true, done: true, error: true, createdAt: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}
