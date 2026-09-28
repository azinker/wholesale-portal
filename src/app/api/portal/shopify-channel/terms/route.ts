import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

export async function POST() {
  const auth = await requirePortalAccount("manage_channel_billing");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.json({ error: "Channel is off" }, { status: 404 });
  }
  const accountId = auth.user.wholesaleAccount!.id;
  await db.shopifyTermsAcceptance.upsert({
    where: { accountId_version: { accountId, version: SHOPIFY_CHANNEL_TERMS_VERSION } },
    create: { accountId, userId: auth.user.id, version: SHOPIFY_CHANNEL_TERMS_VERSION },
    update: {},
  });
  return NextResponse.json({ ok: true });
}
