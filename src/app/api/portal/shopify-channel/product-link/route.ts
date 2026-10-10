import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { decrypt } from "@/lib/bigcommerce/encryption";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { readProduct } from "@/lib/shopify-channel/shopify-admin";
import { channelVisibility } from "@/lib/shopify-channel/visibility";

/** Opens the customer-facing Shopify product. Edit links go straight to Shopify admin. */
export async function GET(req: NextRequest) {
  const auth = await requirePortalAccount("view_channel");
  const orders = appUrl("/my-shopify/orders");
  if (!auth.user?.wholesaleAccount || !(await channelVisibility(auth.user.email)).visible) {
    return NextResponse.redirect(orders);
  }
  const connectionId = req.nextUrl.searchParams.get("connectionId") || "";
  const bcProductId = Number(req.nextUrl.searchParams.get("bcProductId") || "");
  if (!connectionId || !Number.isInteger(bcProductId)) return NextResponse.redirect(orders);

  const connection = await db.shopifyConnection.findFirst({
    where: { id: connectionId, accountId: auth.user.wholesaleAccount.id, disconnectedAt: null },
  });
  const listing = connection
    ? await db.channelListing.findFirst({
        where: { connectionId, bcProductId, removedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (!connection || !listing) return NextResponse.redirect(orders);

  const admin = `https://${connection.shopDomain}/admin/products/${listing.shopifyProductId}`;
  if (!connection.accessTokenEnc) return NextResponse.redirect(admin);
  try {
    const live = await readProduct(connection.shopDomain, decrypt(connection.accessTokenEnc), listing.shopifyProductId);
    if (live?.handle) return NextResponse.redirect(`https://${connection.shopDomain}/products/${live.handle}`);
  } catch {
    // The admin product page is still a useful place to land.
  }
  return NextResponse.redirect(admin);
}
