import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/bigcommerce/encryption";
import { requirePortalAccount } from "@/lib/portal-auth";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { readOrderAddress } from "@/lib/shopify-channel/shopify-admin";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_billing");
  const home = appUrl("/my-shopify");
  if (!auth.user?.wholesaleAccount || !(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.redirect(home);
  }
  const form = await req.formData();
  const connectionId = String(form.get("connectionId") || "");
  const token = String(form.get("token") || "").trim();
  const orderId = String(form.get("orderId") || "").trim();
  const connection = await db.shopifyConnection.findFirst({
    where: { id: connectionId, accountId: auth.user.wholesaleAccount.id, disconnectedAt: null },
  });
  if (!connection || !token || !orderId) return NextResponse.redirect(home);
  const address = await readOrderAddress(connection.shopDomain, token, orderId).catch(() => null);
  if (!address?.street || !address.name) {
    await db.shopifyConnection.update({
      where: { id: connection.id },
      data: { addressTestStatus: "FAILED" },
    });
    return NextResponse.redirect(home);
  }
  await db.shopifyConnection.update({
    where: { id: connection.id },
    data: {
      orderTokenEnc: encrypt(token),
      addressSource: "CUSTOM_APP_TOKEN",
      addressTestStatus: "PASSED",
    },
  });
  return NextResponse.redirect(home, 303);
}
