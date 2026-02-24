import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import { getTierStatusForOrder, loadTierWindowDays, loadTiers } from "@/lib/tier-engine";
import { formatTierWindowLabel } from "@/lib/tier-window";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, AlertCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { OrdersTable } from "./orders-table";

const ORDERS_PER_PAGE = 250;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/");

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const customerId = user.linkedCustomerId;
  let orders: BCOrder[] = [];
  let fetchError = "";

  if (customerId) {
    try {
      orders = await bc().getOrders({
        customer_id: customerId,
        limit: ORDERS_PER_PAGE,
        page: currentPage,
        sort: "date_created",
        direction: "desc",
      });
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Failed to fetch orders";
    }
  }

  // If we got a full page of results, there might be more
  const hasMore = orders.length >= ORDERS_PER_PAGE;
  const tierWindowDays = await loadTierWindowDays();
  const tierWindowLabel = formatTierWindowLabel(tierWindowDays);

  // Tier progress (approved wholesale accounts only)
  const account = user.wholesaleAccount;
  let tierProgress: {
    count: number;
    targetOrders: number;
    progress: number;
    currentTierLabel: string;
    nextTierLabel: string | null;
    ordersToNext: number;
  } | null = null;

  if (account?.status === "APPROVED") {
    const tierDefs = await loadTiers();
    const sorted = [...tierDefs].sort((a, b) => a.minOrders - b.minOrders);
    const tiers = sorted.map((t, i) => ({
      id: t.id,
      label: t.label,
      min: t.minOrders,
      max: i < sorted.length - 1 ? sorted[i + 1].minOrders - 1 : Infinity,
    }));
    const count = account.lastCount7d ?? 0;
    let currentTierIdx: number;
    if (account.lastTier === "WELCOME") {
      const sortedDesc = [...tiers].sort((a, b) => b.min - a.min);
      const earned = sortedDesc.find((t) => count >= t.min);
      currentTierIdx = earned ? tiers.findIndex((t) => t.id === earned.id) : -1;
    } else {
      currentTierIdx = tiers.findIndex((t) => t.id === account.lastTier);
    }
    const currentTier = currentTierIdx >= 0 ? tiers[currentTierIdx] : null;
    const nextTier =
      currentTierIdx >= 0 && currentTierIdx < tiers.length - 1 ? tiers[currentTierIdx + 1] : null;
    const targetOrders = nextTier ? nextTier.min : (currentTier?.max ?? 0);
    const progress = nextTier ? Math.min((count / nextTier.min) * 100, 100) : 100;
    tierProgress = {
      count,
      targetOrders: targetOrders === Infinity ? 0 : targetOrders,
      progress,
      currentTierLabel: currentTier?.label ?? (account.lastTier === "WELCOME" ? "Welcome" : "None"),
      nextTierLabel: nextTier?.label ?? null,
      ordersToNext: nextTier ? Math.max(nextTier.min - count, 0) : 0,
    };
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-primary" />
          Orders
        </h1>
        <p className="text-muted-foreground mt-1">
          View your recent orders from The Perfect Part.
        </p>
      </div>

      {tierProgress && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tier progress (last {tierWindowLabel})
            </CardTitle>
            <CardDescription>
              <span className="font-mono font-medium text-foreground">{tierProgress.count}</span>
              {" "}qualifying orders count toward your tier
              {tierProgress.targetOrders > 0 && (
                <> · Current: <strong>{tierProgress.currentTierLabel}</strong></>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-primary">{tierProgress.count}</span>
                <span className="text-muted-foreground">
                  / {tierProgress.targetOrders === 0 ? "—" : tierProgress.targetOrders} qualifying orders
                </span>
              </div>
              {tierProgress.ordersToNext > 0 && tierProgress.nextTierLabel && (
                <p className="text-sm text-muted-foreground">
                  {tierProgress.ordersToNext} more to unlock <strong>{tierProgress.nextTierLabel}</strong>
                </p>
              )}
              {tierProgress.ordersToNext === 0 && tierProgress.nextTierLabel === null && (
                <p className="text-sm text-success font-medium">Maximum tier reached</p>
              )}
            </div>
            {tierProgress.targetOrders > 0 && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${tierProgress.progress}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!customerId && (
        <Card className="border-warning/30 bg-warning-light/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              Your account is not yet linked. Orders will appear once connected.
            </p>
          </CardContent>
        </Card>
      )}

      {fetchError && (
        <Card className="border-danger/30 bg-danger-light/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
            <p className="text-sm text-danger">{fetchError}</p>
          </CardContent>
        </Card>
      )}

      {customerId && orders.length === 0 && !fetchError && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {currentPage > 1 ? "No more orders found." : "No orders found."}
            </p>
          </CardContent>
        </Card>
      )}

      {orders.length > 0 && (
        <OrdersTable
          orders={orders.map((o) => ({
            id: o.id,
            date_created: o.date_created,
            status: o.status,
            items_total: o.items_total,
            total_inc_tax: o.total_inc_tax,
            tierStatus: getTierStatusForOrder(o.date_created, o.status_id, tierWindowDays),
          }))}
          currentPage={currentPage}
          hasMore={hasMore}
          windowDays={tierWindowDays}
        />
      )}
    </div>
  );
}
