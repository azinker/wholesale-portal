import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_billing");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.redirect(appUrl("/my-shopify"));
  }
  if (!(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.redirect(appUrl("/my-shopify"));
  }
  const form = await req.formData();
  const connectionId = String(form.get("connectionId") || "");
  const paused = String(form.get("paused") || "") === "true";
  await db.shopifyConnection.updateMany({
    where: { id: connectionId, accountId: auth.user.wholesaleAccount.id },
    data: { paused },
  });
  return NextResponse.redirect(appUrl("/my-shopify"), 303);
}
