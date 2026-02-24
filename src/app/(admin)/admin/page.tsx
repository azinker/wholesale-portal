import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  UserCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  Activity,
  Server,
  Trophy,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Lock,
  FileEdit,
  Crown,
  Medal,
  Award,
} from "lucide-react";
import { getAvatarUrls } from "@/lib/avatar";
import { loadTierWindowDays } from "@/lib/tier-engine";
import { formatTierWindowLabel } from "@/lib/tier-window";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function AdminDashboardPage() {
  const [
    totalAccounts,
    pendingCount,
    approvedCount,
    deniedCount,
    openFlags,
    pendingInfoChanges,
    recentLogs,
    topCustomers,
    tierWindowDays,
  ] = await Promise.all([
    db.wholesaleAccount.count(),
    db.wholesaleAccount.count({ where: { status: "PENDING" } }),
    db.wholesaleAccount.count({ where: { status: "APPROVED" } }),
    db.wholesaleAccount.count({ where: { status: "DENIED" } }),
    db.riskFlag.count({ where: { status: "OPEN" } }),
    db.businessInfoChange.count({ where: { status: "PENDING" } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Fetch all approved customers with their data for the leaderboard
    db.wholesaleAccount.findMany({
      where: { status: "APPROVED" },
      orderBy: { lastCount7d: "desc" },
      include: {
        user: { select: { id: true, avatarKey: true } },
        promotions: {
          where: { enabled: true },
          select: { tier: true, code: true },
        },
        snapshots: {
          orderBy: { asOf: "desc" },
          take: 30, // Last 30 snapshots to compute lifetime stats
          select: { paidOrders7d: true, asOf: true, tierLevel: true },
        },
        riskFlags: {
          where: { status: "OPEN" },
          select: { id: true },
        },
      },
    }),
    loadTierWindowDays(),
  ]);
  const tierWindowLabel = formatTierWindowLabel(tierWindowDays);

  // Batch-fetch avatar URLs
  const avatarMap = await getAvatarUrls(
    topCustomers.map((c) => ({ id: c.userId, avatarKey: c.user.avatarKey }))
  );

  // Compute aggregated stats per customer
  const customerStats = topCustomers.map((c) => {
    const snapshots = c.snapshots;
    // Peak 7-day orders ever recorded
    const peakOrders = snapshots.length > 0
      ? Math.max(...snapshots.map((s) => s.paidOrders7d))
      : c.lastCount7d;
    // Average 7-day orders across snapshots
    const avgOrders = snapshots.length > 0
      ? Math.round(snapshots.reduce((sum, s) => sum + s.paidOrders7d, 0) / snapshots.length)
      : c.lastCount7d;
    // Days since approved
    const daysSinceApproved = c.approvedAt
      ? Math.floor((Date.now() - c.approvedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    // Tier consistency: how often they've been above NONE
    const tieredSnapshots = snapshots.filter((s) => s.tierLevel !== "NONE").length;
    const tierConsistency = snapshots.length > 0
      ? Math.round((tieredSnapshots / snapshots.length) * 100)
      : 0;

    return {
      ...c,
      peakOrders,
      avgOrders,
      daysSinceApproved,
      tierConsistency,
      activePromo: c.promotions[0] ?? null,
      riskFlagCount: c.riskFlags.length,
      avatarUrl: avatarMap.get(c.userId) ?? null,
    };
  });

  // Sort by current 7-day orders descending (already done by query), take top 10
  const topWholesalers = customerStats.slice(0, 10);

  // Aggregate stats across all customers
  const totalCurrent7dOrders = customerStats.reduce((sum, c) => sum + c.lastCount7d, 0);
  const customersAtT20 = customerStats.filter((c) => c.lastTier === "T20").length;
  const customersAtT15 = customerStats.filter((c) => c.lastTier === "T15").length;
  const customersAtT10 = customerStats.filter((c) => c.lastTier === "T10").length;
  const customersAtNone = customerStats.filter((c) => c.lastTier === "NONE").length;

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground mt-1">
          Wholesale portal management dashboard.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Total Applications"
          value={totalAccounts}
          href="/admin/applicants"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending Review"
          value={pendingCount + pendingInfoChanges}
          variant={pendingCount + pendingInfoChanges > 0 ? "warning" : "default"}
          href="/admin/applicants"
          subtext={pendingInfoChanges > 0 ? `+${pendingInfoChanges} info changes` : undefined}
        />
        <StatCard
          icon={<UserCheck className="h-4 w-4" />}
          label="Approved"
          value={approvedCount}
          variant="success"
          href="/admin/customers"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Open Risk Flags"
          value={openFlags}
          variant={openFlags > 0 ? "danger" : "default"}
          href="/admin/risk-flags"
        />
      </div>

      {/* Tier Distribution + Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tier Distribution
            </CardTitle>
            <CardDescription>Current tier breakdown of approved customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TierBar label="T20 (20% off)" count={customersAtT20} total={approvedCount} color="bg-success" />
            <TierBar label="T15 (15% off)" count={customersAtT15} total={approvedCount} color="bg-warning" />
            <TierBar label="T10 (10% off)" count={customersAtT10} total={approvedCount} color="bg-info" />
            <TierBar label="None" count={customersAtNone} total={approvedCount} color="bg-muted-foreground/30" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Wholesale Pulse
            </CardTitle>
            <CardDescription>Real-time wholesale metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total {tierWindowDays}-Day Orders (all customers)</span>
              <span className="font-bold text-lg">{totalCurrent7dOrders}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Avg Orders per Customer ({tierWindowDays}d)</span>
              <span className="font-mono">
                {approvedCount > 0 ? (totalCurrent7dOrders / approvedCount).toFixed(1) : "0"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Customers with Active Tier</span>
              <span className="font-mono">
                {customersAtT10 + customersAtT15 + customersAtT20} / {approvedCount}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Target Store</span>
              <Badge variant="outline" className="font-mono text-xs">
                {process.env.TARGET_STORE || "dev"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Prod Writes</span>
              {process.env.PRODUCTION_WRITES_ENABLED === "true" ? (
                <Badge variant="destructive" className="text-xs">ENABLED</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">BLOCKED</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Wholesalers Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            Top Wholesalers
          </CardTitle>
          <CardDescription>
            Your most active wholesale customers ranked by current {tierWindowLabel} order volume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topWholesalers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No approved customers yet. Approve applicants to see them here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Tier</th>
                    <th className="text-right px-4 py-3 font-medium">{tierWindowDays}d Orders</th>
                    <th className="text-right px-4 py-3 font-medium">Peak {tierWindowDays}d</th>
                    <th className="text-right px-4 py-3 font-medium">Avg {tierWindowDays}d</th>
                    <th className="text-right px-4 py-3 font-medium">Tier %</th>
                    <th className="text-left px-4 py-3 font-medium">Active Code</th>
                    <th className="text-right px-4 py-3 font-medium">Days Active</th>
                    <th className="text-left px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {topWholesalers.map((c, idx) => {
                    const RankIcon = idx === 0 ? Crown : idx === 1 ? Medal : idx === 2 ? Award : null;
                    const rankColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];

                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          {RankIcon ? (
                            <RankIcon className={`h-5 w-5 ${rankColors[idx]}`} />
                          ) : (
                            <span className="text-muted-foreground font-mono text-xs pl-0.5">
                              {idx + 1}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border flex-shrink-0">
                              {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt={c.companyName} />}
                              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                {getInitials(c.companyName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{c.companyName}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {c.email}
                                {c.customerId && <span className="ml-1 opacity-60">· #{c.customerId}</span>}
                              </p>
                            </div>
                            {c.riskFlagCount > 0 && (
                              <AlertTriangle className="h-3.5 w-3.5 text-danger flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <TierBadge tier={c.lastTier} />
                            {c.pausedUpgrades && (
                              <Lock className="h-3 w-3 text-warning" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold font-mono">{c.lastCount7d}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {c.peakOrders}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {c.avgOrders}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-xs ${
                            c.tierConsistency >= 70
                              ? "text-success"
                              : c.tierConsistency >= 40
                                ? "text-warning"
                                : "text-muted-foreground"
                          }`}>
                            {c.tierConsistency}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.activePromo ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {c.activePromo.code}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                          {c.daysSinceApproved}d
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="xs" asChild>
                            <Link href={`/admin/customers/${c.id}`}>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {customerStats.length > 10 && (
            <div className="pt-3 text-center">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/customers">
                  View All {customerStats.length} Customers <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest audit log entries</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.actorEmail} &middot; {log.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" asChild className="w-full mt-2">
                <Link href="/admin/audit-log">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  variant = "default",
  href,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "danger";
  href: string;
  subtext?: string;
}) {
  const borderColors = {
    default: "",
    success: "border-success/30",
    warning: "border-warning/30",
    danger: "border-danger/30",
  };
  const valueColors = {
    default: "",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };

  return (
    <Link href={href}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${borderColors[variant]}`}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className={`text-3xl font-bold ${valueColors[variant]}`}>{value}</p>
          {subtext && (
            <p className="text-[10px] text-muted-foreground mt-1">{subtext}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    NONE: "bg-muted text-muted-foreground",
    T10: "bg-info-light text-info",
    T15: "bg-warning-light text-warning",
    T20: "bg-success-light text-success",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[tier] || colors.NONE}`}>
      {tier === "NONE" ? "None" : tier}
    </Badge>
  );
}

function TierBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {count} <span className="text-xs text-muted-foreground">({Math.round(pct)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
