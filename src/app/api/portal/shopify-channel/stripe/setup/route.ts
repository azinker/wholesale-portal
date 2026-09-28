import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortalAccount } from "@/lib/portal-auth";
import { env } from "@/lib/env";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { createCardSetupCheckout, createStripeCustomer, stripeConfigured } from "@/lib/shopify-channel/stripe";

export async function POST(req: NextRequest) {
  const auth = await requirePortalAccount("manage_channel_billing");
  if (!auth.user?.wholesaleAccount) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 });
  }
  if (!(await channelVisibility(auth.user.email)).visible || !stripeConfigured()) {
    return NextResponse.redirect(new URL("/billing", req.url));
  }
  const account = auth.user.wholesaleAccount;
  const existing = await db.sellerPaymentMethod.findUnique({ where: { accountId: account.id } });
  const customerId = existing?.stripeCustomerId || (await createStripeCustomer(account.email, account.companyName));
  const base = env().NEXT_PUBLIC_APP_URL;
  const url = await createCardSetupCheckout(
    customerId,
    `${base}/billing?session_id={CHECKOUT_SESSION_ID}`,
    `${base}/billing`
  );
  return NextResponse.redirect(url, 303);
}
