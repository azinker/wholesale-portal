import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCheck, ArrowRight, Lock } from "lucide-react";
import { ImpersonateButton } from "@/components/impersonate-button";
import TierRecalcButton from "./tier-recalc-button";
import RecreatePromotionsButton from "./recreate-promotions-button";
import { getAvatarUrls } from "@/lib/avatar";
import { EnrollCustomerForm } from "./enroll-customer-form";
import { loadTierWindowDays } from "@/lib/tier-engine";

/** Get initials from a company name */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default async function CustomersPage() {
  const tierWindowDays = await loadTierWindowDays();
  const customers = await db.wholesaleAccount.findMany({
    where: { status: "APPROVED" },
    orderBy: { approvedAt: "desc" },
    include: {
      user: {
        select: { id: true, avatarKey: true },
      },
      promotions: {
        where: { enabled: true },
        select: { tier: true, code: true },
      },
    },
  });

  // Batch-fetch avatar URLs for all users who have one
  const avatarMap = await getAvatarUrls(
    customers.map((c) => ({ id: c.userId, avatarKey: c.user.avatarKey }))
  );

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            Customers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage approved wholesale customers, tiers, and promotions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnrollCustomerForm />
          <RecreatePromotionsButton />
          <TierRecalcButton />
        </div>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No approved customers yet. Approve applicants to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Tier</th>
                  <th className="text-left px-4 py-3 font-medium">{tierWindowDays}d Orders</th>
                  <th className="text-left px-4 py-3 font-medium">Active Code</th>
                  <th className="text-left px-4 py-3 font-medium">BC ID</th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                  <th className="text-left px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const activePromo = c.promotions[0];
                  const avatarUrl = avatarMap.get(c.userId) ?? null;

                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border flex-shrink-0">
                            {avatarUrl && <AvatarImage src={avatarUrl} alt={c.companyName} />}
                            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                              {getInitials(c.companyName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{c.companyName}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                          </div>
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
                      <td className="px-4 py-3 font-mono">{c.lastCount7d}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {activePromo ? activePromo.code : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.customerId ? `#${c.customerId}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="xs" asChild>
                          <Link href={`/admin/customers/${c.id}`}>
                            Manage <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <ImpersonateButton userId={c.userId} userEmail={c.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    NONE: "bg-muted text-muted-foreground",
    WELCOME: "bg-purple-100 text-purple-700",
    T10: "bg-info-light text-info",
    T15: "bg-warning-light text-warning",
    T20: "bg-success-light text-success",
    T25: "bg-emerald-100 text-emerald-700",
    T30: "bg-emerald-200 text-emerald-800",
  };
  const label = tier === "NONE" ? "None" : tier === "WELCOME" ? "Welcome" : tier;
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[tier] || colors.NONE}`}>
      {label}
    </Badge>
  );
}
