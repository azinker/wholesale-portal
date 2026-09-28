import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { emailAccount } from "@/lib/shopify-channel/notify";
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
    await emailAccount(
      job.requestedByEmail,
      "Your Shopify listings stopped",
      `Added ${job.addedCount}, skipped ${job.skippedCount}, failed ${job.failedCount}. ${connection.shopDomain} was disconnected, so the rest was not added. Listings already on the store stay there. Stock updates for that store have stopped.`
    );
  }

  return NextResponse.redirect(appUrl("/my-shopify"), 303);
}
