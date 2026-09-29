import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { runNextPublishJob } from "@/lib/shopify-channel/publish";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalAccount("manage_channel_listings");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  const access = await channelVisibility(auth.user.email);
  if (!access.visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await context.params;
  const job = await db.channelPublishJob.findFirst({
    where: { id, accountId: auth.user.wholesaleAccount.id },
  });
  if (!job) return NextResponse.json({ error: "That add could not be found" }, { status: 404 });
  if (job.status === "QUEUED" || job.status === "RUNNING") {
    await runNextPublishJob(job.id);
  }
  const fresh = await db.channelPublishJob.findUnique({ where: { id: job.id } });
  return NextResponse.json({
    status: fresh?.status || job.status,
    addedCount: fresh?.addedCount || 0,
    skippedCount: fresh?.skippedCount || 0,
    failedCount: fresh?.failedCount || 0,
  });
}
