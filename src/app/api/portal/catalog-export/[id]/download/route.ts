import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { getSignedDownloadUrl } from "@/lib/storage";
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
    where: { id, accountId: auth.user.wholesaleAccount.id, status: "READY" },
    select: { fileKey: true },
  });
  if (!job?.fileKey) return NextResponse.json({ error: "The file is not ready" }, { status: 404 });
  const url = await getSignedDownloadUrl(job.fileKey, "perfect-part-listings.zip", 600);
  return NextResponse.redirect(url);
}
