import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { sendListingsStoppedEmail } from "@/lib/email";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_billing");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  const access = await channelVisibility(auth.user.email);
  if (!access.visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData();
  const connectionId = String(form.get("connectionId") || "");
  const connection = await db.shopifyConnection.findFirst({
    where: { id: connectionId, accountId: auth.user.wholesaleAccount.id, disconnectedAt: null },
  });
  if (!connection) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  await db.shopifyConnection.update({
    where: { id: connection.id },
    data: { disconnectedAt: new Date() },
  });
  const jobs = await db.channelPublishJob.findMany({
    where: { connectionId: connection.id, status: { in: ["QUEUED", "RUNNING"] } },
  });
  for (const job of jobs) {
    await db.channelPublishJob.update({
      where: { id: job.id },
      data: { status: "FAILED", emailSentAt: new Date() },
    });
    await sendListingsStoppedEmail({
      to: job.requestedByEmail,
      shopDomain: connection.shopDomain,
      added: job.addedCount,
      skipped: job.skippedCount,
      failed: job.failedCount,
    });
  }

  return NextResponse.redirect(appUrl("/my-shopify"), 303);
}
