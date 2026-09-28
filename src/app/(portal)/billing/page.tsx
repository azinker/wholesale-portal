import Link from "next/link";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { easternMonthKey } from "@/lib/shopify-channel/calendar";
import { stripeConfigured, readCheckoutSession, readSetupIntent, readCard } from "@/lib/shopify-channel/stripe";
import { retryCardAttention } from "@/lib/shopify-channel/orders";
import { ChannelSchemaNotice } from "../channel-schema-notice";
import {
  ChannelHeading,
  ChannelPage,
  ChannelPanel,
  StatusPill,
  attentionLabel,
  channelPrimaryBtn,
  money,
  statusLabel,
} from "../channel-ui";

function toneFor(status: string): "good" | "wait" | "bad" | "neutral" {
  if (status === "SHIPPED" || status === "SUBMITTED" || status === "PICKING" || status === "CHARGED") return "good";
  if (status === "NEEDS_ATTENTION" || status === "FAILED") return "bad";
  if (status === "REFUNDED") return "neutral";
  return "wait";
}

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
  const attention = orders.filter((order) => order.status === "NEEDS_ATTENTION");
  const months = Array.from(new Set(orders.map((order) => easternMonthKey(order.createdAt))));

  const stats = [
    { label: "Buyer paid", value: money(sold), hint: "What customers paid on Shopify" },
    { label: "Charged", value: money(charged), hint: "Already taken from the credit card" },
    { label: "Margin", value: money(sold - charged), hint: "Before Shopify fees, which we do not know" },
  ];

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify channel"
        title="Billing"
        lede="We charge the credit card saved here when a Shopify order is paid. The statement name is THE PERFECT PART. This page is a record of charges already taken, not a second bill."
      />

      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((stat, index) => (
          <ChannelPanel key={stat.label} delay={index * 60} className="px-5 py-4">
            <p className="text-xs font-medium text-[#5c5654]">{stat.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-[#5c5654]">{stat.hint}</p>
          </ChannelPanel>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <ChannelPanel className="overflow-hidden" delay={80}>
          <div className="bg-gradient-to-br from-[#2d2d2d] to-[#6d2428] p-6 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Credit card on this account</p>
            <p className="mt-8 font-display text-2xl tracking-wide">
              {card ? `${card.brand} ···· ${card.last4}` : "No credit card saved"}
            </p>
            <p className="mt-6 text-xs text-white/70">THE PERFECT PART</p>
          </div>
          <div className="space-y-3 p-5 text-sm">
            {canBill && stripeConfigured() && (
              <form action="/api/portal/shopify-channel/stripe/setup" method="post">
                <button className={channelPrimaryBtn} type="submit">
                  {card ? "Replace credit card" : "Save a credit card"}
                </button>
              </form>
            )}
            {canBill && !stripeConfigured() && <p className="text-[#5c5654]">Credit card setup is not configured yet.</p>}
            {!canBill && <p className="text-[#5c5654]">Only an owner or admin can save the credit card.</p>}
            <p className="leading-6 text-[#5c5654]">This is the credit card we charge for Shopify orders. It is not store credit.</p>
            {preview && (
              <p className="leading-6 text-[#5c5654]">Saving a credit card uses the live Stripe account. A sample order does not charge it.</p>
            )}
            <Link href="/my-shopify" className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Back to My Shopify
            </Link>
          </div>
        </ChannelPanel>

        <div className="space-y-4">
          {attention.length > 0 && (
            <ChannelPanel className="border-red-200 bg-red-50 p-5">
              <h2 className="font-semibold text-red-900">Needs attention</h2>
              <div className="mt-3 space-y-2">
                {attention.map((order) => (
                  <Link key={order.id} href={`/my-shopify/orders/${order.id}`} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm transition-colors duration-200 hover:bg-[#fff7f7]">
                    <span className="font-semibold">{order.shopifyOrderName}</span>
                    <span className="text-[#5c5654]">{attentionLabel(order.attentionNote)}</span>
                  </Link>
                ))}
              </div>
            </ChannelPanel>
          )}

          {months.length === 0 && (
            <ChannelPanel className="px-6 py-12 text-center">
              <p className="font-semibold">No channel orders yet</p>
              <p className="mt-1 text-sm text-[#5c5654]">Charges show up here after a paid Shopify order is processed.</p>
            </ChannelPanel>
          )}

          {months.map((month) => {
            const monthOrders = orders.filter((order) => easternMonthKey(order.createdAt) === month && order.status !== "NEEDS_ATTENTION");
            const monthSold = monthOrders.reduce((sum, order) => sum + Number(order.soldFor), 0);
            const monthCharged = monthOrders.reduce((sum, order) => sum + Number(order.amountCharged) - Number(order.amountRefunded), 0);
            return (
              <ChannelPanel key={month} className="overflow-hidden">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f0ebe8] px-5 py-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold">{month}</h2>
                    <p className="text-sm text-[#5c5654]">
                      {monthOrders.length} orders · buyers paid {money(monthSold)} · charged {money(monthCharged)} · margin {money(monthSold - monthCharged)}
                    </p>
                  </div>
                  <a className="cursor-pointer text-sm font-semibold text-primary hover:underline" href={`/api/portal/shopify-channel/invoice?month=${month}`}>
                    Download spreadsheet
                  </a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-[#2d2d2d] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                      <tr>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-3 py-3">Buyer paid</th>
                        <th className="px-3 py-3">Charged</th>
                        <th className="px-3 py-3">Shipping</th>
                        <th className="px-3 py-3">Margin</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthOrders.map((order) => {
                        const net = Number(order.amountCharged) - Number(order.amountRefunded);
                        return (
                          <tr key={order.id} className="border-t border-[#f0ebe8] transition-colors duration-200 hover:bg-[#faf7f6]">
                            <td className="px-4 py-3">
                              <Link className="font-semibold hover:underline" href={`/my-shopify/orders/${order.id}`}>{order.shopifyOrderName}</Link>
                            </td>
                            <td className="px-3 py-3 tabular-nums">{money(Number(order.soldFor))}</td>
                            <td className="px-3 py-3 tabular-nums">
                              {money(net)}
                              {Number(order.amountRefunded) > 0 && (
                                <span className="block text-xs text-[#5c5654]">Refunded {money(Number(order.amountRefunded))}</span>
                              )}
                            </td>
                            <td className="px-3 py-3 tabular-nums">{money(Number(order.shippingCharged))}</td>
                            <td className="px-3 py-3 tabular-nums font-semibold text-emerald-700">{money(Number(order.soldFor) - net)}</td>
                            <td className="px-4 py-3"><StatusPill tone={toneFor(order.status)}>{statusLabel(order.status)}</StatusPill></td>
                          </tr>
                        );
                      })}
                      {monthOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#5c5654]">Nothing settled in this month yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ChannelPanel>
            );
          })}
        </div>
      </div>
    </ChannelPage>
  );
}
