import { redirect } from "next/navigation";
import { BarChart3, CalendarDays, ShoppingCart, Ticket } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadPublisherTierConfig } from "@/lib/publisher-tier-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PerformancePage() {
  const user = await getUser();
  if (!user) redirect("/");
  const account = user.wholesaleAccount;
  if (!account || account.partnerType !== "AFFILIATE_PUBLISHER") redirect("/dashboard");

  const { windowDays } = await loadPublisherTierConfig();
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const [orders, lifetimeCount, windowAggregate] = await Promise.all([
    db.publisherOrderAttribution.findMany({ where: { accountId: account.id }, orderBy: { orderDate: "desc" }, take: 100 }),
    db.publisherOrderAttribution.count({ where: { accountId: account.id } }),
    db.publisherOrderAttribution.aggregate({
      where: { accountId: account.id, orderDate: { gte: windowStart } },
      _count: true,
      _sum: { subtotal: true },
    }),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 className="h-6 w-6 text-primary" /> Performance</h1><p className="mt-1 text-muted-foreground">Coupon-attributed order activity. AWIN remains the source of truth for commission reporting.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarDays} label={`Attributed orders (${windowDays}d)`} value={String(windowAggregate._count)} />
        <Stat icon={ShoppingCart} label="Lifetime attributed orders" value={String(lifetimeCount)} />
        <Stat icon={Ticket} label={`${windowDays}d attributed subtotal`} value={windowAggregate._sum.subtotal ? `$${Number(windowAggregate._sum.subtotal).toFixed(2)}` : "—"} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent attributed orders</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No attributed orders yet.</p> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="px-4 py-3 text-left">Order</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Audience code</th><th className="px-4 py-3 text-right">Subtotal</th></tr></thead>
                <tbody>{orders.map((order) => <tr key={order.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">#{order.orderId}</td><td className="px-4 py-3 text-muted-foreground">{order.orderDate.toLocaleString()}</td><td className="px-4 py-3 font-mono text-xs">{order.couponCode}</td><td className="px-4 py-3 text-right font-mono">{order.subtotal ? `$${Number(order.subtotal).toFixed(2)}` : "—"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">This page reports audience-code attribution used for portal tiers. Review AWIN for validated commission, reversals, and payments.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <Card><CardContent className="py-5"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>;
}
