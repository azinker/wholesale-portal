import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import { loadTiers, type TierId } from "@/lib/tier-engine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Target,
  Zap,
  CalendarDays,
  ArrowUpRight,
  ShoppingCart,
  Trophy,
} from "lucide-react";

export default async function InsightsPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const account = user.wholesaleAccount;
  if (!account || account.status !== "APPROVED") {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Statistics and insights will be available once your wholesale account is approved.
          </p>
        </div>
      </div>
    );
  }

  // Fetch orders and tier snapshots
  const customerId = user.linkedCustomerId;
  let allOrders: BCOrder[] = [];

  if (customerId) {
    try {
      allOrders = await bc().getOrders({ customer_id: customerId, limit: 250, page: 1 });
    } catch {
      // If BC fails, continue with empty orders
    }
  }

  const snapshots = await db.tierSnapshot.findMany({
    where: { accountId: account.id },
    orderBy: { asOf: "desc" },
    take: 30,
  });

  const activePromo = await db.promotionRecord.findFirst({
    where: { accountId: account.id, enabled: true },
    select: { code: true, tier: true },
  });

  // ── Compute statistics ──────────────────────────────────
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Parse order dates and totals
  const parsed = allOrders.map((o) => ({
    ...o,
    _date: new Date(o.date_created),
    _total: parseFloat(o.total_inc_tax) || 0,
    _items: o.items_total || 0,
  }));

  const orders7d = parsed.filter((o) => o._date >= sevenDaysAgo);
  const orders30d = parsed.filter((o) => o._date >= thirtyDaysAgo);

  const totalOrders = parsed.length;
  const totalRevenue = parsed.reduce((sum, o) => sum + o._total, 0);
  const totalItems = parsed.reduce((sum, o) => sum + o._items, 0);

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const avgItemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;

  const revenue7d = orders7d.reduce((sum, o) => sum + o._total, 0);
  const revenue30d = orders30d.reduce((sum, o) => sum + o._total, 0);

  const avgOrder7d = orders7d.length > 0 ? revenue7d / orders7d.length : 0;
  const avgOrder30d = orders30d.length > 0 ? revenue30d / orders30d.length : 0;

  // Largest single order
  const largestOrder = parsed.length > 0 ? Math.max(...parsed.map((o) => o._total)) : 0;

  // Most recent order
  const mostRecent = parsed.length > 0 ? parsed[0] : null;

  // Tier progress
  const currentTier = account.lastTier as TierId;
  const count7d = account.lastCount7d;

  const dynamicTiers = await loadTiers();
  const tiers = [
    { id: "NONE" as const, label: "No Discount", minOrders: 0, discount: 0 },
    ...dynamicTiers,
  ];
  // For WELCOME tier, compute the earned tier index for progress display
  let currentTierIdx: number;
  if (currentTier === "WELCOME") {
    const sorted = [...dynamicTiers].sort((a, b) => b.minOrders - a.minOrders);
    const earned = sorted.find((t) => count7d >= t.minOrders);
    currentTierIdx = earned ? tiers.findIndex((t) => t.id === earned.id) : 0;
  } else {
    currentTierIdx = tiers.findIndex((t) => t.id === currentTier);
  }
  const nextTier = currentTierIdx < tiers.length - 1 ? tiers[currentTierIdx + 1] : null;
  const ordersToNext = nextTier ? Math.max(nextTier.minOrders - count7d, 0) : 0;
  const progressPct = nextTier ? Math.min((count7d / nextTier.minOrders) * 100, 100) : 100;

  // Best 7d streak from snapshots
  const bestStreak = snapshots.length > 0 ? Math.max(...snapshots.map((s) => s.paidOrders7d)) : count7d;

  // Estimated monthly savings (based on current tier discount)
  const currentDiscount = currentTier === "WELCOME" ? 0 : (dynamicTiers.find((t) => t.id === currentTier)?.discount || 0);
  const estMonthlySavings = revenue30d * (currentDiscount / 100);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Insights
        </h1>
        <p className="text-muted-foreground mt-1">
          Your wholesale account statistics and performance metrics.
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Orders (7 days)"
          value={String(orders7d.length)}
          subtext={`${count7d} qualifying`}
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Revenue (7 days)"
          value={`$${revenue7d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg. Order Value"
          value={`$${avgOrderValue.toFixed(2)}`}
          subtext="all time"
        />
        <MetricCard
          icon={<Package className="h-4 w-4" />}
          label="Avg. Items/Order"
          value={avgItemsPerOrder.toFixed(1)}
          subtext="all time"
        />
      </div>

      {/* Tier Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Tier Progress
          </CardTitle>
          <CardDescription>
            Your current standing and what it takes to reach the next level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="default" className="text-sm px-3 py-1">
              {currentTier === "NONE" ? "No Tier" : currentTier === "WELCOME" ? "Welcome" : currentTier}
            </Badge>
            {currentDiscount > 0 && (
              <span className="text-sm text-muted-foreground">{currentDiscount}% discount active</span>
            )}
            {account.pausedUpgrades && (
              <Badge variant="outline" className="text-xs border-warning text-warning">Locked by Admin</Badge>
            )}
          </div>

          {nextTier ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress to {nextTier.id} ({nextTier.discount}% off)</span>
                <span className="font-mono font-medium">{count7d} / {nextTier.minOrders} orders</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {ordersToNext > 0
                  ? <>You need <strong className="text-foreground">{ordersToNext} more qualifying orders</strong> in the next 7-day window to unlock <strong>{nextTier.discount}% off</strong>.</>
                  : <>You&apos;ve met the threshold! Your tier will update on the next recalculation cycle.</>
                }
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-success">
              <Trophy className="h-5 w-5" />
              <span className="font-medium">Maximum tier reached! You&apos;re getting {currentDiscount}% off all orders.</span>
            </div>
          )}

          {/* Tier ladder */}
          <Separator />
          <div className="grid grid-cols-4 gap-2 text-center">
            {tiers.map((t) => {
              const isActive = t.id === currentTier;
              const isPassed = tiers.indexOf(t) <= currentTierIdx;
              return (
                <div key={t.id} className={`rounded-lg border p-3 transition-colors ${isActive ? "border-primary bg-primary/5" : isPassed ? "border-success/30 bg-success-light/30" : "border-border opacity-50"}`}>
                  <p className="text-lg font-bold">{t.discount}%</p>
                  <p className="text-[10px] text-muted-foreground">{t.minOrders > 0 ? `${t.minOrders}+ orders` : "Base"}</p>
                  {isActive && <Badge className="mt-1 text-[9px] h-4 px-1.5">You</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Volume Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Volume Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StatRow label="Total Orders (All Time)" value={String(totalOrders)} />
            <Separator />
            <StatRow label="Orders (Last 30 Days)" value={String(orders30d.length)} />
            <Separator />
            <StatRow label="Revenue (Last 30 Days)" value={`$${revenue30d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Separator />
            <StatRow label="Avg. Order (Last 7 Days)" value={`$${avgOrder7d.toFixed(2)}`} />
            <Separator />
            <StatRow label="Avg. Order (Last 30 Days)" value={`$${avgOrder30d.toFixed(2)}`} />
            <Separator />
            <StatRow label="Largest Single Order" value={`$${largestOrder.toFixed(2)}`} />
            <Separator />
            <StatRow label="Total Revenue (All Time)" value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </CardContent>
        </Card>

        {/* Savings & Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Savings & Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StatRow label="Current Discount" value={currentDiscount > 0 ? `${currentDiscount}%` : "None"} highlight={currentDiscount > 0} />
            <Separator />
            <StatRow label="Est. Savings (Last 30 Days)" value={`$${estMonthlySavings.toFixed(2)}`} highlight />
            <Separator />
            <StatRow label="Active Promo Code" value={activePromo?.code || "None"} mono />
            <Separator />
            <StatRow label="Best 7-Day Streak" value={`${bestStreak} orders`} />
            <Separator />
            <StatRow label="Current 7-Day Count" value={`${count7d} orders`} />
            <Separator />
            {mostRecent && (
              <>
                <StatRow label="Last Order" value={`#${mostRecent.id} — $${mostRecent._total.toFixed(2)}`} />
                <Separator />
                <StatRow label="Last Order Date" value={mostRecent._date.toLocaleDateString()} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tier History */}
      {snapshots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Tier History
            </CardTitle>
            <CardDescription>
              Your recent tier snapshots showing 7-day performance over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshots.slice(0, 15).map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{s.asOf.toLocaleDateString()}</span>
                  <TierBadge tier={s.tierLevel} />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min((s.paidOrders7d / 101) * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs font-mono w-16 text-right">{s.paidOrders7d} orders</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <ArrowUpRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium">Tips to Maximize Your Wholesale Benefits</p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Qualifying orders must be <strong>shipped or completed</strong> within a rolling 7-day window.</li>
                <li>Consolidate purchases early in the week to hit tier thresholds faster.</li>
                {nextTier && <li>At your current pace, focus on {ordersToNext} more orders to unlock {nextTier.discount}% off.</li>}
                <li>Your promo code stacks with free Flat Rate shipping on US orders.</li>
                <li>Tiers recalculate daily — consistent ordering keeps your discount active.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value, subtext }: { icon: React.ReactNode; label: string; value: string; subtext?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
          {icon}
          <span className="text-[11px] font-medium">{label}</span>
        </div>
        <p className="text-xl font-bold">{value}</p>
        {subtext && <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? "text-success" : ""} ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    NONE: "bg-muted text-muted-foreground",
    T10: "bg-info-light text-info",
    T15: "bg-warning-light text-warning",
    T20: "bg-success-light text-success",
  };
  return <Badge variant="outline" className={`text-[10px] w-12 justify-center ${colors[tier] || colors.NONE}`}>{tier === "NONE" ? "—" : tier}</Badge>;
}
