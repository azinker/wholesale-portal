import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/storage";
import { requireExportAccount } from "@/lib/shopify-channel/export-access";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireExportAccount();
  if (!access.account) return access.response;
  const { id } = await context.params;
  const job = await db.catalogExport.findFirst({
    where: { id, accountId: access.account.id, status: "READY" },
    select: { fileKey: true },
  });
  if (!job?.fileKey) return NextResponse.json({ error: "The file is not ready" }, { status: 404 });
  const url = await getSignedDownloadUrl(job.fileKey, "perfect-part-listings.zip", 600);
  return NextResponse.redirect(url);
}
