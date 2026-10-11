import Link from "next/link";
import { db } from "@/lib/db";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { loadChannelSetup } from "@/lib/shopify-channel/setup";
import { ChannelSetupGate } from "../../channel-setup-gate";
import {
  affiliatedLines,
  fullyRefunded,
  isAffiliatedOrder,
  netCharged,
  orderView,
  wasCharged,
  whenEastern,
  type OrderLine,
} from "@/lib/shopify-channel/order-view";
import { gettingReadyTip } from "@/lib/shopify-channel/calendar";
import { looksLikeUsps, uspsTrackingUrl } from "@/lib/shopify-channel/shopify-admin";
import { ChannelSchemaNotice } from "../../channel-schema-notice";
import { Tip, TipLabel } from "../../tip";
import { ProductMenu, type ProductLink } from "./product-menu";
import { RefreshOrdersButton } from "./refresh-orders";
import {
  ChannelHeading,
  ChannelPage,
  ChannelPanel,
  StatusPill,
  orderRowClass,
  channelField,
  channelPrimaryBtn,
  money,
  statusLabel,
} from "../../channel-ui";

type View = "all" | "awaiting" | "shipped" | "attention";

function toneFor(status: string): "good" | "wait" | "bad" | "neutral" {
  if (status === "SHIPPED" || status === "DELIVERED" || status === "CHARGED" || status === "SUBMITTED" || status === "PICKING") return "good";
  if (status === "NEEDS_ATTENTION" || status === "FAILED" || status === "REFUNDED") return "bad";
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
  searchParams: Promise<{ view?: string; product?: string; q?: string; refresh?: string }>;
}) {
  const { account, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const setup = await loadChannelSetup(account.id);
  if (!setup.ready) {
    return (
      <ChannelSetupGate
        setup={setup}
        title="Orders"
        lede="Orders from your Shopify store stay hidden until the terms, a card, and a Shopify store are finished."
      />
    );
  }
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

  const connections = await db.shopifyConnection.findMany({
    where: { accountId: account.id, disconnectedAt: null },
    select: { ordersCheckedAt: true },
  });
  const lastChecked = connections.reduce<Date | null>((latest, row) => {
    if (!row.ordersCheckedAt) return latest;
    if (!latest || row.ordersCheckedAt > latest) return row.ordersCheckedAt;
    return latest;
  }, null);
  const refreshNote =
    params.refresh === "error"
      ? "Couldn't reach Shopify just now. Try again in a minute."
      : params.refresh === "new"
        ? "Checked just now. New orders are in the list."
        : null;

  const productIds = [
    ...new Set(
      orders.flatMap((order) => affiliatedLines(order.lines).map((line) => line.bcProductId).filter((id): id is number => Boolean(id)))
    ),
  ];
  const listings = productIds.length
    ? await db.channelListing.findMany({
        where: { accountId: account.id, removedAt: null, bcProductId: { in: productIds } },
        select: { connectionId: true, bcProductId: true, shopifyProductId: true },
      })
    : [];
  const listingByProduct = new Map(listings.map((row) => [`${row.connectionId}:${row.bcProductId}`, row]));

  function productLinks(order: (typeof orders)[number], lines: OrderLine[]): ProductLink[] {
    const seen = new Set<number>();
    const links: ProductLink[] = [];
    for (const line of lines) {
      if (!line.bcProductId || seen.has(line.bcProductId)) continue;
      seen.add(line.bcProductId);
      const title = line.title || "Product";
      const listing = listingByProduct.get(`${order.connectionId}:${line.bcProductId}`);
      links.push({
        title,
        catalogHref: `/catalog?q=${encodeURIComponent(title)}`,
        ordersHref: `/my-shopify/orders?product=${line.bcProductId}`,
        storeHref: listing
          ? `/api/portal/shopify-channel/product-link?connectionId=${order.connectionId}&bcProductId=${line.bcProductId}`
          : null,
        adminHref: listing
          ? `https://${order.connection.shopDomain}/admin/products/${listing.shopifyProductId}`
          : null,
      });
    }
    return links;
  }

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
      <Link href="/my-shopify" className="inline-flex items-center text-sm font-semibold text-primary hover:underline">
        Back to My Shopify
      </Link>
      <ChannelHeading
        kicker="Shopify"
        title="Orders"
        lede="These are sales of products you added from the catalog. Your other Shopify products stay on Shopify and don't show up here."
      >
        <form action="/api/portal/shopify-channel/orders/refresh" method="post" className="flex flex-col items-start gap-2 sm:items-end">
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          {productId > 0 && <input type="hidden" name="product" value={String(productId)} />}
          {params.q && <input type="hidden" name="q" value={params.q} />}
          <RefreshOrdersButton />
          <p className="max-w-xs text-xs leading-5 text-[#5c5654] sm:text-right">
            New orders show up on their own. Tracking shows here after the warehouse adds it. Refresh checks for that.
            {" "}
            {lastChecked ? `Last checked ${whenEastern(lastChecked)}.` : "Not checked yet."}
          </p>
          {refreshNote && <p className="max-w-xs text-xs font-medium text-[#1a1a1a] sm:text-right">{refreshNote}</p>}
        </form>
      </ChannelHeading>

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
                <th className="px-3 py-3"><TipLabel tone="dark" tip="Click the name to view it on your Shopify store, edit it in Shopify, or open it in the catalog.">Product</TipLabel></th>
                <th className="px-3 py-3"><TipLabel tone="dark" tip="What your customer paid you on Shopify. Click the amount to open this order.">Buyer paid</TipLabel></th>
                <th className="px-3 py-3"><TipLabel tone="dark" tip="What we charged your card when the order was paid. Open it to see that charge on Billing.">Charge</TipLabel></th>
                <th className="px-3 py-3"><TipLabel tone="dark" tip="Tracking after we ship. US shipping is $0. We ship after the card charge.">Shipment</TipLabel></th>
                <th className="px-4 py-3"><TipLabel tone="dark" tip="Awaiting shipment, shipped, or needs a look.">Status</TipLabel></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => {
                const lines = affiliatedLines(order.lines);
                const net = netCharged(order);
                const credit = Number(order.storeCreditApplied || 0);
                const charged = wasCharged(order) || credit > 0;
                const refunded = fullyRefunded(order);
                const trackHref = order.trackingUrl || (order.trackingNumber && looksLikeUsps(order.trackingNumber) ? uspsTrackingUrl(order.trackingNumber) : null);
                return (
                  <tr key={order.id} className={`border-t border-[#f0ebe8] transition-colors duration-200 hover:bg-[#faf7f6] ${orderRowClass(order.status)}`}>
                    <td className="px-4 py-3">
                      <Link href={`/my-shopify/orders/${order.id}`} className="font-semibold hover:underline">{order.shopifyOrderName}</Link>
                      <p className="text-xs text-[#5c5654]">{whenEastern(order.createdAt)} · {order.connection.shopDomain}</p>
                    </td>
                    <td className="px-3 py-3">
                      <ProductMenu label={productLabel(lines)} products={productLinks(order, lines)} />
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <Link href={`/my-shopify/orders/${order.id}`} className="font-semibold hover:underline">
                        {money(Number(order.soldFor))}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {refunded ? (
                        <Link href={`/billing?order=${order.id}#charge`} className="font-semibold text-red-800 hover:underline">
                          Refunded
                          <span className="block text-xs font-semibold">Card refund {money(Number(order.amountRefunded))}</span>
                        </Link>
                      ) : charged ? (
                        <Link href={`/billing?order=${order.id}#charge`} className="font-semibold tabular-nums text-primary hover:underline">
                          {credit > 0 && net <= 0 ? "Store credit" : money(net)}
                          {credit > 0 && <span className="block text-xs font-semibold text-emerald-700">Store credit {money(credit)}</span>}
                        </Link>
                      ) : (
                        <span className="text-[#5c5654]">Not charged yet</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {order.status === "SHIPPED" || order.status === "DELIVERED" || (order.status === "REFUNDED" && order.trackingNumber) ? (
                        order.trackingNumber ? (
                          trackHref ? (
                            <a className="font-semibold text-primary hover:underline" href={trackHref} target="_blank" rel="noreferrer">{order.trackingNumber}</a>
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
                      <StatusPill
                        tone={toneFor(order.status)}
                        tip={order.status === "SUBMITTED" ? gettingReadyTip(order.chargedAt || order.createdAt) : order.status === "REFUNDED" ? "We refunded this charge on your card. That does not refund the customer who paid you on Shopify." : undefined}
                      >
                        {statusLabel(order.status)}
                      </StatusPill>
                      {order.deliveredAt ? <p className="mt-1 text-xs text-emerald-800">Delivered {whenEastern(order.deliveredAt)}</p> : order.shippedAt ? <p className="mt-1 text-xs text-[#5c5654]">Shipped {whenEastern(order.shippedAt)}</p> : null}
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
