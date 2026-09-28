import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_billing");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.redirect(new URL("/my-shopify", req.url));
  }
  if (!(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.redirect(new URL("/my-shopify", req.url));
  }
  const form = await req.formData();
  const connectionId = String(form.get("connectionId") || "");
  const paused = String(form.get("paused") || "") === "true";
  await db.shopifyConnection.updateMany({
    where: { id: connectionId, accountId: auth.user.wholesaleAccount.id },
    data: { paused },
  });
  return NextResponse.redirect(new URL("/my-shopify", req.url), 303);
}
