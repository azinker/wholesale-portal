import Link from "next/link";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { easternMonthKey } from "@/lib/shopify-channel/calendar";
import { stripeConfigured, readCheckoutSession, readSetupIntent, readCard } from "@/lib/shopify-channel/stripe";
import { retryCardAttention } from "@/lib/shopify-channel/orders";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelSchemaNotice } from "../channel-schema-notice";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { user, account, preview, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const { session_id: sessionId } = await searchParams;
  const canBill = userHasPermission(user, "manage_channel_billing");

  if (sessionId && canBill && stripeConfigured()) {
    const session = await readCheckoutSession(sessionId);
    if (session.setupIntentId) {
      const setup = await readSetupIntent(session.setupIntentId);
      if (setup.status === "succeeded" && setup.paymentMethodId && setup.customerId) {
        const card = await readCard(setup.paymentMethodId);
        await db.sellerPaymentMethod.upsert({
          where: { accountId: account.id },
          create: {
            accountId: account.id,
            stripeCustomerId: setup.customerId,
            stripePaymentMethodId: setup.paymentMethodId,
            brand: card.brand,
            last4: card.last4,
          },
          update: {
            stripeCustomerId: setup.customerId,
            stripePaymentMethodId: setup.paymentMethodId,
            brand: card.brand,
            last4: card.last4,
          },
        });
        await retryCardAttention(account.id);
      }
    }
  }

  const card = await db.sellerPaymentMethod.findUnique({ where: { accountId: account.id } });
  const orders = await db.channelOrder.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const charged = orders.reduce((sum, row) => sum + Number(row.amountCharged) - Number(row.amountRefunded), 0);
  const sold = orders.reduce((sum, row) => sum + Number(row.soldFor), 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          We charge the card on this account when a Shopify order is paid. The statement name is THE PERFECT PART.
          This page is a record of charges already taken.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3 text-sm">
          {card ? (
            <p>Card on file: {card.brand} ending {card.last4}</p>
          ) : (
            <p>No card saved yet.</p>
          )}
          {canBill && stripeConfigured() && (
            <form action="/api/portal/shopify-channel/stripe/setup" method="post">
              <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm" type="submit">
                {card ? "Replace card" : "Save a card"}
              </button>
            </form>
          )}
          {canBill && !stripeConfigured() && <p>Card setup is not configured yet.</p>}
          {!canBill && <p>Only an owner or admin can save the card.</p>}
          {preview && <p>Saving a card uses the live Stripe account. A sample order does not charge it.</p>}
          <p>Buyer paid ${sold.toFixed(2)}. Charged ${charged.toFixed(2)}. Margin ${(sold - charged).toFixed(2)} before Shopify fees, which we do not know.</p>
          <Link href="/my-shopify">Back to My Shopify</Link>
        </CardContent>
      </Card>
      {orders.some((order) => order.status === "NEEDS_ATTENTION") && (
        <div className="space-y-3">
          <h2 className="font-medium">Needs attention</h2>
          {orders.filter((order) => order.status === "NEEDS_ATTENTION").map((order) => (
            <Card key={order.id}>
              <CardContent className="pt-6 text-sm">
                <Link className="underline" href={`/my-shopify/orders/${order.id}`}>{order.shopifyOrderName}</Link>
                <p>{order.attentionNote?.replaceAll("_", " ")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {Array.from(new Set(orders.map((order) => easternMonthKey(order.createdAt)))).map((month) => {
        const monthOrders = orders.filter((order) => easternMonthKey(order.createdAt) === month && order.status !== "NEEDS_ATTENTION");
        const monthSold = monthOrders.reduce((sum, order) => sum + Number(order.soldFor), 0);
        const monthCharged = monthOrders.reduce((sum, order) => sum + Number(order.amountCharged) - Number(order.amountRefunded), 0);
        return (
          <div key={month} className="space-y-3">
            <h2 className="font-medium">{month}</h2>
            <p className="text-sm text-muted-foreground">
              {monthOrders.length} orders. Buyers paid ${monthSold.toFixed(2)}. Charged ${monthCharged.toFixed(2)}. Margin ${(monthSold - monthCharged).toFixed(2)}. This is a record of charges already taken, not a second bill.
            </p>
            <Link className="text-sm underline" href={`/api/portal/shopify-channel/invoice?month=${month}`}>Download spreadsheet</Link>
            {monthOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="pt-6 text-sm space-y-1">
                  <Link className="font-medium underline" href={`/my-shopify/orders/${order.id}`}>{order.shopifyOrderName}</Link>
                  <p>Buyer paid ${Number(order.soldFor).toFixed(2)}</p>
                  <p>Charged ${Number(order.amountCharged).toFixed(2)} including shipping ${Number(order.shippingCharged).toFixed(2)}</p>
                  {Number(order.amountRefunded) > 0 && <p>Refunded ${Number(order.amountRefunded).toFixed(2)}</p>}
                  <p>Status {order.status.replaceAll("_", " ").toLowerCase()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}
