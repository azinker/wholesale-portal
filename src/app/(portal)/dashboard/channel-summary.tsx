import Link from "next/link";
import { db } from "@/lib/db";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { easternMonthKey } from "@/lib/shopify-channel/calendar";
import { isAffiliatedOrder } from "@/lib/shopify-channel/order-view";
import { statusLabel } from "../channel-ui";

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export async function ChannelSummary({ accountId, email }: { accountId: string; email: string }) {
  const access = await channelVisibility(email);
  if (!access.visible) return null;
  let stores = 0;
  let listings = 0;
  let ordersThisMonth = 0;
  let sold = 0;
  let charged = 0;
  let latest: Array<{ id: string; name: string; status: string; trackingNumber: string | null }> = [];
  try {
    const month = easternMonthKey(new Date());
    const [storeCount, listingCount, orders] = await Promise.all([
      db.shopifyConnection.count({
        where: { accountId, disconnectedAt: null, NOT: { shopDomain: { startsWith: "preview-" } } },
      }),
      db.channelListing.count({ where: { accountId, removedAt: null } }),
      db.channelOrder.findMany({
        where: { accountId, shopifyOrderId: { not: "preview" } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);
    stores = storeCount;
    listings = listingCount;
    const monthOrders = orders.filter((order) => isAffiliatedOrder(order) && easternMonthKey(order.createdAt) === month);
    ordersThisMonth = monthOrders.length;
    sold = monthOrders.reduce((sum, order) => sum + Number(order.soldFor), 0);
    charged = monthOrders.reduce((sum, order) => sum + Number(order.amountCharged) - Number(order.amountRefunded), 0);
    latest = orders.filter((order) => isAffiliatedOrder(order)).slice(0, 4).map((order) => ({
      id: order.id,
      name: order.shopifyOrderName,
      status: statusLabel(order.status),
      trackingNumber: order.trackingNumber,
    }));
  } catch {
    return null;
  }

  const margin = sold - charged;
  const stats = [
    { label: "Your stores", value: String(stores), hint: "Shopify stores connected" },
    { label: "Products listed", value: String(listings), hint: "Added from our catalog" },
    { label: "Orders this month", value: String(ordersThisMonth), hint: "Customers who paid you" },
    { label: "You kept", value: money(margin), hint: "Before Shopify's own fees" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7e1de] bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f0ebe8] px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Shopify</p>
          <h2 className="font-display text-xl font-semibold">Your Shopify sales</h2>
          {access.preview && <p className="text-xs text-[#5c5654]">Only you can see this while we finish testing.</p>}
        </div>
        <Link href="/my-shopify/orders" className="cursor-pointer text-sm font-semibold text-primary hover:underline">
          Open orders
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border-t border-[#f0ebe8] px-5 py-4 md:border-t-0 md:border-l md:first:border-l-0">
            <p className="text-xs text-[#5c5654]">{stat.label}</p>
            <p className={`font-display text-2xl font-semibold tabular-nums ${stat.label === "You kept" ? (margin < 0 ? "text-[#9c2126]" : "text-emerald-700") : ""}`}>{stat.value}</p>
            <p className="mt-1 text-[11px] text-[#8a8481]">{stat.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-4">
        {[
          ["/catalog", "Add products"],
          ["/my-shopify/orders", "See orders"],
          ["/billing", "Card and charges"],
          ["/export", "Export a spreadsheet"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-[#e7e1de] px-3 py-1.5 text-xs font-semibold text-[#1a1a1a] hover:border-[#2d2d2d]">
            {label}
          </Link>
        ))}
      </div>
      <p className="px-5 pb-2 text-xs text-[#5c5654]">
        Customers paid you {money(sold)}. We charged your card {money(charged)}. You kept is the difference, before Shopify's own fees.
      </p>
      {latest.length > 0 && (
        <div className="border-t border-[#f0ebe8]">
          {latest.map((order) => (
            <Link key={order.id} href={`/my-shopify/orders/${order.id}`} className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 text-sm transition-colors duration-200 hover:bg-[#faf7f6]">
              <span className="font-semibold">{order.name}</span>
              <span className="text-[#5c5654]">{order.status}{order.trackingNumber ? ` · ${order.trackingNumber}` : ""}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
