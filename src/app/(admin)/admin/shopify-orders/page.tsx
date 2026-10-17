import Link from "next/link";
import { db } from "@/lib/db";
import { statusLabel } from "@/app/(portal)/channel-ui";
import { shopifyStoreStatus } from "@/lib/shopify-channel/store-status";
import { RefundOrder } from "./refund-order";

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default async function AdminShopifyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const orders = await db.channelOrder.findMany({
    where: { shopifyOrderId: { not: "preview" } },
    include: {
      account: { select: { id: true, companyName: true, email: true } },
      connection: { select: { shopDomain: true, disconnectedAt: true, paused: true, addressTestStatus: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const stores = await db.shopifyConnection.findMany({
    include: {
      account: { select: { id: true, companyName: true, email: true } },
      _count: { select: { listings: { where: { removedAt: null } } } },
    },
    orderBy: [{ disconnectedAt: "asc" }, { account: { companyName: "asc" } }],
  });
  const rows = q
    ? orders.filter((order) =>
        [order.shopifyOrderName, order.account.companyName, order.account.email, order.connection.shopDomain, String(order.bcOrderId || "")]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : orders;
  const storeRows = q
    ? stores.filter((store) =>
        [store.shopDomain, store.account.companyName, store.account.email].join(" ").toLowerCase().includes(q)
      )
    : stores;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
        <h1 className="font-display text-3xl font-semibold">Shopify orders</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c5654]">
          These are orders a dropshipper&apos;s customer paid on Shopify. We charged the dropshipper&apos;s card. Refunding here sends that charge back to their card and emails them. It does not refund their customer. They do that on Shopify. Refunding the same order inside BigCommerce does not return the card charge.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q || ""}
          placeholder="Search company, email, store, or order"
          className="w-full max-w-md rounded-xl border border-[#e4ddd9] px-3 py-2 text-sm"
        />
        <button className="rounded-xl bg-[#2d2d2d] px-4 py-2 text-sm font-semibold text-white" type="submit">
          Search
        </button>
      </form>

      <div>
        <h2 className="text-lg font-semibold">Connected stores</h2>
        <p className="mt-1 text-sm text-[#5c5654]">Each row is one Shopify store and the wholesale account that connected it.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#e7e1de] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[#f0ebe8] text-xs uppercase tracking-wide text-[#5c5654]">
            <tr>
              <th className="px-4 py-3 font-medium">Dropshipper</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Products listed</th>
            </tr>
          </thead>
          <tbody>
            {storeRows.map((store) => (
              <tr key={store.id} className="border-b border-[#f6f3f1] last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${store.account.id}`} className="font-medium hover:underline">
                    {store.account.companyName}
                  </Link>
                  <p className="text-xs text-[#5c5654]">{store.account.email}</p>
                </td>
                <td className="px-4 py-3 font-medium">{store.shopDomain}</td>
                <td className="px-4 py-3">{shopifyStoreStatus(store)}</td>
                <td className="px-4 py-3 tabular-nums">{store._count.listings}</td>
              </tr>
            ))}
            {storeRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#5c5654]">No connected stores match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold">Orders</h2>
      <div className="overflow-x-auto rounded-2xl border border-[#e7e1de] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[#f0ebe8] text-xs uppercase tracking-wide text-[#5c5654]">
            <tr>
              <th className="px-4 py-3 font-medium">Dropshipper</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Charged</th>
              <th className="px-4 py-3 font-medium">Left</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => {
              const charged = Number(order.amountCharged);
              const remaining = Math.max(0, charged - Number(order.amountRefunded));
              return (
                <tr key={order.id} className="border-b border-[#f6f3f1] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${order.account.id}`} className="font-medium hover:underline">
                      {order.account.companyName}
                    </Link>
                    <p className="text-xs text-[#5c5654]">{order.account.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.connection.shopDomain}</p>
                    <p className="text-xs text-[#5c5654]">{shopifyStoreStatus(order.connection)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.shopifyOrderName}</p>
                    <p className="text-xs text-[#5c5654]">{order.bcOrderId ? `Warehouse ${order.bcOrderId}` : "No warehouse order"}</p>
                  </td>
                  <td className="px-4 py-3">{statusLabel(order.status)}</td>
                  <td className="px-4 py-3 tabular-nums">{money(charged)}</td>
                  <td className="px-4 py-3 tabular-nums">{money(remaining)}</td>
                  <td className="px-4 py-3 text-right">
                    <RefundOrder
                      orderId={order.id}
                      orderName={order.shopifyOrderName}
                      remaining={remaining}
                      shipped={order.status === "SHIPPED" || order.status === "DELIVERED"}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#5c5654]">No Shopify orders match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
