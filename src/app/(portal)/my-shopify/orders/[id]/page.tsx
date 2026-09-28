import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { ChannelSchemaNotice } from "../../../channel-schema-notice";
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
  const { account, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const { id } = await params;
  const order = await db.channelOrder.findFirst({
    where: { id, accountId: account.id },
    include: { connection: true },
  });
  if (!order) notFound();
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
          <Link href="/billing" className={channelGhostBtn}>Back to Billing</Link>
        </div>
      </ChannelHeading>

      {preview && (
        <ChannelPanel className="border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Sample order. No card was charged and nothing was sent to a warehouse.
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
            <Link className={channelPrimaryBtn} href={`/support?category=shopify_order_change&order=${encodeURIComponent(order.shopifyOrderName)}`}>
              Request a change
            </Link>
          </ChannelPanel>

          <ChannelPanel className="bg-[#2d2d2d] p-5 text-sm text-white">
            <h2 className="font-display text-lg font-semibold">Money</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3"><dt className="text-white/70">Buyer paid</dt><dd className="tabular-nums">{money(sold)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-white/70">Our product cost</dt><dd className="tabular-nums">{money(goods || Number(order.goodsCharged))}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-white/70">Shipping we charged</dt><dd className="tabular-nums">{money(Number(order.shippingCharged))}</dd></div>
              <div className="flex justify-between gap-3 border-t border-white/15 pt-2"><dt>Total we charged</dt><dd className="tabular-nums font-semibold">{money(net)}</dd></div>
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
