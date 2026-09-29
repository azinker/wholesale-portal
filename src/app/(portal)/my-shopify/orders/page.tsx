import Link from "next/link";
import { db } from "@/lib/db";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import {
  affiliatedLines,
  isAffiliatedOrder,
  netCharged,
  orderView,
  wasCharged,
  whenEastern,
  type OrderLine,
} from "@/lib/shopify-channel/order-view";
import { ChannelSchemaNotice } from "../../channel-schema-notice";
import { Tip, TipLabel } from "../../tip";
import {
  ChannelHeading,
  ChannelPage,
  ChannelPanel,
  StatusPill,
  channelField,
  channelPrimaryBtn,
  money,
  statusLabel,
} from "../../channel-ui";

type View = "all" | "awaiting" | "shipped" | "attention";

function toneFor(status: string): "good" | "wait" | "bad" | "neutral" {
  if (status === "SHIPPED" || status === "CHARGED" || status === "SUBMITTED" || status === "PICKING") return "good";
  if (status === "NEEDS_ATTENTION" || status === "FAILED") return "bad";
  if (status === "REFUNDED") return "neutral";
  return "wait";
}

function productLabel(lines: OrderLine[]): string {
  const first = lines[0]?.title || "Product";
  if (lines.length <= 1) return first;
  return `${first} + ${lines.length - 1} more`;
}

export default async function ChannelOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; product?: string; q?: string }>;
}) {
  const { account, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const params = await searchParams;
  const view: View = params.view === "awaiting" || params.view === "shipped" || params.view === "attention" ? params.view : "all";
  const productId = params.product && Number.isInteger(Number(params.product)) ? Number(params.product) : 0;
  const query = (params.q || "").trim().toLowerCase();

  const stored = await db.channelOrder.findMany({
    where: { accountId: account.id, shopifyOrderId: { not: "preview" } },
    include: { connection: { select: { shopDomain: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const orders = stored.filter((order) => isAffiliatedOrder(order));
  const products = new Map<number, string>();
  for (const order of orders) {
    for (const line of affiliatedLines(order.lines)) {
      if (line.bcProductId && line.title && !products.has(line.bcProductId)) products.set(line.bcProductId, line.title);
    }
  }

  const visible = orders.filter((order) => {
    const lines = affiliatedLines(order.lines);
    if (productId && !lines.some((line) => line.bcProductId === productId)) return false;
    if (query) {
      const haystack = [order.shopifyOrderName, order.connection.shopDomain, ...lines.map((line) => line.title || "")]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (view === "all") return true;
    return orderView(order.status) === view;
  });

  const awaiting = orders.filter((order) => orderView(order.status) === "awaiting").length;
  const shipped = orders.filter((order) => orderView(order.status) === "shipped").length;
  const attention = orders.filter((order) => orderView(order.status) === "attention").length;

  function href(next: Partial<{ view: View; product: string; q: string }>) {
    const search = new URLSearchParams();
    const nextView = next.view ?? view;
    const nextProduct = next.product ?? (productId ? String(productId) : "");
    const nextQuery = next.q ?? params.q ?? "";
    if (nextView !== "all") search.set("view", nextView);
    if (nextProduct) search.set("product", nextProduct);
    if (nextQuery) search.set("q", nextQuery);
    const value = search.toString();
    return value ? `/my-shopify/orders?${value}` : "/my-shopify/orders";
  }

  const chips: Array<{ id: View; label: string; count: number }> = [
    { id: "all", label: "All", count: orders.length },
    { id: "awaiting", label: "Awaiting shipment", count: awaiting },
    { id: "shipped", label: "Shipped", count: shipped },
    { id: "attention", label: "Needs attention", count: attention },
  ];

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify channel"
        title="Orders"
        lede="Only orders that include a product you added from the catalog. Other products on your Shopify store never show up here."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <ChannelPanel className="px-5 py-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5c5654]">Awaiting shipment <Tip text="The customer has paid. We charge your card, then ship. Tracking is not on the order yet." /></p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{awaiting}</p>
          <p className="mt-1 text-xs text-[#5c5654]">Paid, not shipped yet</p>
        </ChannelPanel>
        <ChannelPanel className="px-5 py-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5c5654]">Shipped <Tip text="We shipped the order and put tracking on your Shopify order." /></p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{shipped}</p>
          <p className="mt-1 text-xs text-[#5c5654]">Tracking is on the order</p>
        </ChannelPanel>
        <ChannelPanel className="px-5 py-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5c5654]">Needs a look <Tip text="The card was declined, or the order could not finish. Nothing was shipped for a declined card." /></p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{attention}</p>
          <p className="mt-1 text-xs text-[#5c5654]">Not charged, or could not finish</p>
        </ChannelPanel>
      </div>

      <form action="/my-shopify/orders" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e7e1de] bg-white p-3 shadow-sm">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <input name="q" defaultValue={params.q || ""} placeholder="Search order number or product" className={`${channelField} min-w-[220px] flex-1`} aria-label="Search orders" />
        <select name="product" defaultValue={productId ? String(productId) : ""} className={`${channelField} w-auto min-w-[240px]`} aria-label="Product">
          <option value="">All products you added</option>
          {[...products.entries()].map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        <button className={channelPrimaryBtn} type="submit">Show</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const on = view === chip.id;
          return (
            <Link
              key={chip.id}
              href={href({ view: chip.id })}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-[#2d2d2d] text-white" : "border border-[#e4ddd9] bg-white text-[#3f3a38] hover:border-[#2d2d2d]"}`}
            >
              {chip.label} ({chip.count})
            </Link>
          );
        })}
      </div>

      <ChannelPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[#2d2d2d] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              <tr>
                <th className="px-4 py-3"><TipLabel tone="dark" tip="Your Shopify order number. Open it for the address, products, and tracking.">Order</TipLabel></th>
                <th className="px-3 py-3"><TipLabel tone="dark" tip="A product you added from the catalog. Other products on your Shopify store are not listed here.">Product</TipLabel></th>
                <th className="px-3 py-3"><TipLabel tone="dark" tip="What your customer paid you on Shopify.">Buyer paid</TipLabel></th>
                <th className="px-3 py-3"><TipLabel tone="dark" tip="What we charged your card when the order was paid. Open it to see that charge on Billing.">Charge</TipLabel></th>
                <th className="px-3 py-3"><TipLabel tone="dark" tip="Tracking after we ship. US shipping is $0. We ship after the card charge.">Shipment</TipLabel></th>
                <th className="px-4 py-3"><TipLabel tone="dark" tip="Awaiting shipment, shipped, or needs a look.">Status</TipLabel></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => {
                const lines = affiliatedLines(order.lines);
                const net = netCharged(order);
                const charged = wasCharged(order);
                return (
                  <tr key={order.id} className="border-t border-[#f0ebe8] transition-colors duration-200 hover:bg-[#faf7f6]">
                    <td className="px-4 py-3">
                      <Link href={`/my-shopify/orders/${order.id}`} className="font-semibold hover:underline">{order.shopifyOrderName}</Link>
                      <p className="text-xs text-[#5c5654]">{whenEastern(order.createdAt)} · {order.connection.shopDomain}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={href({ product: String(lines[0]?.bcProductId || ""), view: "all" })} className="hover:underline">
                        {productLabel(lines)}
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{money(Number(order.soldFor))}</td>
                    <td className="px-3 py-3">
                      {charged ? (
                        <Link href={`/billing?order=${order.id}#charge`} className="font-semibold tabular-nums text-primary hover:underline">
                          {money(net)}
                        </Link>
                      ) : (
                        <span className="text-[#5c5654]">Not charged yet</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {order.status === "SHIPPED" ? (
                        order.trackingNumber ? (
                          order.trackingUrl ? (
                            <a className="font-semibold text-primary hover:underline" href={order.trackingUrl} target="_blank" rel="noreferrer">{order.trackingNumber}</a>
                          ) : (
                            <span className="font-semibold">{order.trackingNumber}</span>
                          )
                        ) : (
                          <span>Shipped</span>
                        )
                      ) : (
                        <span className="text-[#5c5654]">Not shipped</span>
                      )}
                      {order.carrier && <p className="text-xs text-[#5c5654]">{order.carrier}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={toneFor(order.status)}>{statusLabel(order.status)}</StatusPill>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="font-medium text-[#1a1a1a]">No orders in this view</p>
                    <p className="mt-1 text-sm text-[#5c5654]">Orders appear after a customer pays for a product you added.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChannelPanel>
    </ChannelPage>
  );
}
