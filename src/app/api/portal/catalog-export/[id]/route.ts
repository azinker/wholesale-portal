import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExportAccount } from "@/lib/shopify-channel/export-access";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireExportAccount();
  if (!access.account) return access.response;
  const { id } = await context.params;
  const job = await db.catalogExport.findFirst({
    where: { id, accountId: access.account.id },
    select: { id: true, status: true, total: true, done: true, error: true, createdAt: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}
