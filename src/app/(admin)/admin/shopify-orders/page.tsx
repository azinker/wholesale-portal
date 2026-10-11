import Link from "next/link";
import { db } from "@/lib/db";
import { statusLabel } from "@/app/(portal)/channel-ui";
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
    include: { account: { select: { id: true, companyName: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const rows = q
    ? orders.filter((order) =>
        [order.shopifyOrderName, order.account.companyName, order.account.email, String(order.bcOrderId || "")]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : orders;

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
          placeholder="Search company, email, or order"
          className="w-full max-w-md rounded-xl border border-[#e4ddd9] px-3 py-2 text-sm"
        />
        <button className="rounded-xl bg-[#2d2d2d] px-4 py-2 text-sm font-semibold text-white" type="submit">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-[#e7e1de] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[#f0ebe8] text-xs uppercase tracking-wide text-[#5c5654]">
            <tr>
              <th className="px-4 py-3 font-medium">Dropshipper</th>
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
                <td colSpan={6} className="px-4 py-8 text-center text-[#5c5654]">No Shopify orders match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
