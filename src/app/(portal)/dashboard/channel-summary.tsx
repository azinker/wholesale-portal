import Link from "next/link";
import { db } from "@/lib/db";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { easternMonthKey } from "@/lib/shopify-channel/calendar";
import { Card, CardContent } from "@/components/ui/card";

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
      db.shopifyConnection.count({ where: { accountId, disconnectedAt: null } }),
      db.channelListing.count({ where: { accountId, removedAt: null } }),
      db.channelOrder.findMany({
        where: { accountId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);
    stores = storeCount;
    listings = listingCount;
    const monthOrders = orders.filter((order) => easternMonthKey(order.createdAt) === month);
    ordersThisMonth = monthOrders.length;
    sold = monthOrders.reduce((sum, order) => sum + Number(order.soldFor), 0);
    charged = monthOrders.reduce((sum, order) => sum + Number(order.amountCharged) - Number(order.amountRefunded), 0);
    latest = orders.slice(0, 5).map((order) => ({
      id: order.id,
      name: order.shopifyOrderName,
      status: order.status.replaceAll("_", " ").toLowerCase(),
      trackingNumber: order.trackingNumber,
    }));
  } catch {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-2 text-sm">
        <h2 className="font-medium">Shopify</h2>
        {access.preview && <p>Preview. Other wholesalers do not see this yet.</p>}
        <p>{stores} stores connected. {listings} listings live. {ordersThisMonth} orders this month.</p>
        <p>Buyers paid ${sold.toFixed(2)}. We charged ${charged.toFixed(2)}. Margin ${(sold - charged).toFixed(2)} before Shopify fees.</p>
        {latest.length === 0 ? (
          <p>
            <Link className="underline" href="/my-shopify">Open My Shopify</Link>
          </p>
        ) : (
          <ul className="space-y-1">
            {latest.map((order) => (
              <li key={order.id}>
                <Link className="underline" href={`/my-shopify/orders/${order.id}`}>
                  {order.name}
                </Link>{" "}
                {order.status}
                {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
