import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { isAffiliatedOrder } from "@/lib/shopify-channel/order-view";
import { ChannelSchemaNotice } from "../../../channel-schema-notice";
import { Tip } from "../../../tip";
import {
  ChannelHeading,
  ChannelPage,
  ChannelPanel,
  StatusPill,
  attentionLabel,
  channelGhostBtn,
  channelPrimaryBtn,
  money,
  statusLabel,
} from "../../../channel-ui";

type Line = { title?: string; quantity?: number; salePrice?: number; unitCost?: number; lineCost?: number };
type Ship = {
  name?: string;
  street?: string;
  street2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
};

export default async function ChannelOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { account, schemaReady, enabled } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const { id } = await params;
  const order = await db.channelOrder.findFirst({
    where: { id, accountId: account.id },
    include: { connection: true },
  });
  if (!order || !isAffiliatedOrder(order)) notFound();
  const lines = Array.isArray(order.lines) ? (order.lines as Line[]) : [];
  const ship = (order.shipTo || {}) as Ship;
  const sold = Number(order.soldFor);
  const charged = Number(order.amountCharged);
  const refunded = Number(order.amountRefunded);
  const net = charged - refunded;
  const goods = lines.reduce((sum, line) => sum + Number(line.lineCost || 0), 0);
  const preview = order.shopifyOrderId === "preview";
  const adminUrl = preview
    ? null
    : `https://${order.connection.shopDomain}/admin/orders/${order.shopifyOrderId}`;
  const address = [ship.street, ship.street2, ship.city, ship.province, ship.zip, ship.country].filter(Boolean).join(", ");
  const chargedYet = charged > 0;
  const story = orderStory(order.status, enabled, order.attentionNote);

  return (
    <ChannelPage>
      <ChannelHeading
        kicker={order.connection.shopDomain.startsWith("preview-") ? "Sample store" : order.connection.shopDomain}
        title={order.shopifyOrderName}
        lede={order.createdAt.toLocaleString()}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={order.status === "NEEDS_ATTENTION" || order.status === "FAILED" ? "bad" : order.status === "SHIPPED" ? "good" : "wait"}>
            {statusLabel(order.status)}
          </StatusPill>
          {chargedYet ? (
            <>
              <Link href={`/billing?order=${order.id}#charge`} className={channelPrimaryBtn} title="Opens Billing and shows what we took from your card for this order.">
                See this charge on Billing
              </Link>
              <Tip text="Opens Billing and shows what we took from your card for this order. We charge when the customer pays, before we ship." />
            </>
          ) : null}
          <Link href="/my-shopify/orders" className={channelGhostBtn}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to all orders
          </Link>
        </div>
      </ChannelHeading>

      <ChannelPanel className="px-5 py-4 text-sm leading-6 text-[#3f3a38]">
        <p>{story}</p>
        {!chargedYet && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[#5c5654]">
            <Tip text="We charge your card when the customer pays, before we ship. Nothing has come off your card for this order yet, so there is no charge to open on Billing." />
            Nothing has been charged yet.
          </p>
        )}
      </ChannelPanel>

      {preview && (
        <ChannelPanel className="border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Sample order. No credit card was charged and nothing was sent to a warehouse.
        </ChannelPanel>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ChannelPanel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#2d2d2d] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-3 py-3">Qty</th>
                  <th className="px-3 py-3">Sale</th>
                  <th className="px-3 py-3">Our cost</th>
                  <th className="px-4 py-3">Margin</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const qty = Number(line.quantity || 0);
                  const sale = Number(line.salePrice || 0) * qty;
                  const cost = Number(line.lineCost || 0);
                  return (
                    <tr key={`${line.title}-${index}`} className="border-t border-[#f0ebe8]">
                      <td className="px-4 py-3 font-medium">{line.title}</td>
                      <td className="px-3 py-3 tabular-nums">{qty}</td>
                      <td className="px-3 py-3 tabular-nums">{money(sale)}</td>
                      <td className="px-3 py-3 tabular-nums">{money(Number(line.unitCost || 0))} each · {money(cost)}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-emerald-700">{money(sale - cost)}</td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#5c5654]">No line items on this order.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChannelPanel>

        <div className="space-y-4">
          <ChannelPanel className="space-y-3 p-5 text-sm">
            <h2 className="font-display text-lg font-semibold">Ship to</h2>
            <p className="font-medium">{ship.name || "—"}</p>
            <p className="leading-6 text-[#3f3a38]">{address || "—"}</p>
            <p className="text-[#5c5654]">Phone {ship.phone || "—"}</p>
            {order.checkoutNote && <p className="rounded-xl bg-[#f6f3f1] p-3 text-[#3f3a38]">Note: {order.checkoutNote}</p>}
            <p className="text-[#5c5654]">Tier that day: {order.tier || "—"}</p>
            {order.bcOrderId && <p>Fulfillment number {order.bcOrderId}</p>}
            {order.trackingNumber && (
              <p>
                {order.carrier || "Carrier"}{" "}
                {order.trackingUrl ? (
                  <a className="font-semibold text-primary hover:underline" href={order.trackingUrl} target="_blank" rel="noreferrer">
                    {order.trackingNumber}
                  </a>
                ) : (
                  order.trackingNumber
                )}
              </p>
            )}
            {order.attentionNote && <p className="text-red-800">{attentionLabel(order.attentionNote)}</p>}
            {adminUrl && (
              <a className={channelGhostBtn} href={adminUrl} target="_blank" rel="noreferrer">Open in Shopify admin</a>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className={channelPrimaryBtn}
                href={`/support?category=shopify_order_change&order=${encodeURIComponent(order.shopifyOrderName)}`}
                title="Opens Support so you can ask us to change the address or anything else on this order. This does not charge your card. Editing the order in Shopify does not change our shipment."
              >
                Ask us to change this order
              </Link>
              <Tip text="Opens Support. Use it for an address change or anything else after the sale. It does not charge your card. Changing the order in Shopify does not change what we ship." />
            </div>
          </ChannelPanel>

          <ChannelPanel className="bg-[#2d2d2d] p-5 text-sm text-white">
            <h2 className="font-display text-lg font-semibold">Money</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3"><dt className="inline-flex items-center gap-1.5 text-white/70">Buyer paid <Tip tone="dark" text="What your customer paid you on Shopify." /></dt><dd className="tabular-nums">{money(sold)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="inline-flex items-center gap-1.5 text-white/70">Our product cost <Tip tone="dark" text="The wholesale cost for the products. This is what the product portion of the charge is based on." /></dt><dd className="tabular-nums">{money(goods || Number(order.goodsCharged))}</dd></div>
              <div className="flex justify-between gap-3"><dt className="inline-flex items-center gap-1.5 text-white/70">Shipping we charged <Tip tone="dark" text="US addresses are $0. Every other country is $18.99 once for the order." /></dt><dd className="tabular-nums">{money(Number(order.shippingCharged))}</dd></div>
              <div className="flex justify-between gap-3 border-t border-white/15 pt-2"><dt className="inline-flex items-center gap-1.5">Total we charged <Tip tone="dark" text="Taken from your card when the customer paid, before we ship." /></dt><dd className="tabular-nums font-semibold">{money(net)}</dd></div>
              {refunded > 0 && <div className="flex justify-between gap-3"><dt className="text-white/70">Refunded</dt><dd className="tabular-nums">{money(refunded)}</dd></div>}
              <div className="flex justify-between gap-3 text-emerald-300"><dt>Margin</dt><dd className="tabular-nums font-semibold">{money(sold - net)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-white/60">Before Shopify fees, which we do not know.</p>
          </ChannelPanel>
        </div>
      </div>
    </ChannelPage>
  );
}

function orderStory(status: string, enabled: boolean, attention: string | null): string {
  if (status === "QUEUED" && !enabled) {
    return "Your customer already paid you on Shopify. We saved this order. Your card is not charged, and we do not ship it, until Shopify selling is turned on.";
  }
  if (status === "QUEUED") return "Your customer paid. We charge your card next, then we ship. We do not wait until the package goes out.";
  if (status === "HELD" || status === "NEEDS_ATTENTION" || status === "FAILED") {
    return attentionLabel(attention) || "This order needs a look before we can charge your card and ship it.";
  }
  if (status === "CHARGED") return "Your card was charged when the customer paid. We're sending this to the warehouse next.";
  if (status === "SUBMITTED" || status === "PICKING") return "Your card was charged. We're packing this now, then we ship it.";
  if (status === "SHIPPED") return "We shipped this and put the tracking on your Shopify order.";
  if (status === "REFUNDED") return "This charge was refunded. Nothing is shipping.";
  return "We charge your card when the customer pays, then we ship.";
}
