import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Package, AlertCircle, Clock, XCircle, ShoppingCart, Megaphone, Ticket, Lock, Gift, DollarSign } from "lucide-react";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { loadTierWindowDays, loadTiers, loadWelcomeConfig, isWelcomeActive, tierFromCount, type TierDef } from "@/lib/tier-engine";
import { formatTierWindowLabel } from "@/lib/tier-window";
import { DashboardOnboarding } from "./dashboard-onboarding";
import { CopyCouponButton } from "./copy-coupon-button";
import { WelcomeCountdown } from "./welcome-countdown";
import { TierActivatesCountdown } from "./tier-activates-countdown";
import { DashboardRecalcTrigger } from "./dashboard-recalc-trigger";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const account = user.wholesaleAccount;
  const status = account?.status || "RETAIL";

  // Fetch recent announcements
  const announcements = await db.announcement.findMany({
    where: {
      published: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  // Onboarding data for approved accounts
  let onboardingData = null;
  if (status === "APPROVED" && account && !account.onboardingDismissed) {
    // Count any uploaded document (resale cert, other, business license, etc.) for the checklist
    const hasUploadedDocument = await db.document.count({
      where: { accountId: account.id },
    });
    const flags = (account.onboardingFlags as Record<string, boolean>) || {};

    onboardingData = {
      profileComplete: !!(account.companyName && account.phone),
      hasResaleCert: hasUploadedDocument > 0,
      browsedHotSellers: !!flags.browsedHotSellers,
      hasOrders: (account.lastCount7d ?? 0) > 0,
    };
  }

  // Fetch active coupon for approved accounts
  let activePromo: { code: string; tier: string } | null = null;
  if (status === "APPROVED" && account) {
    const promo = await db.promotionRecord.findFirst({
      where: { accountId: account.id, enabled: true },
      select: { code: true, tier: true },
    });
    activePromo = promo ?? null;
  }

  // Fetch store credit for approved accounts
  let storeCredit = 0;
  if (status === "APPROVED" && account?.customerId) {
    try {
      const customer = await bc().getCustomerById(account.customerId);
      if (customer?.store_credit_amounts && customer.store_credit_amounts.length > 0) {
        storeCredit = customer.store_credit_amounts[0].amount;
      }
    } catch {
      // Ignore errors fetching store credit
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <DashboardRecalcTrigger enabled={status === "APPROVED"} />
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user.email}
        </p>
      </div>

      {/* Status Banner */}
      {status === "RETAIL" && (
        <Card className="border-info/30 bg-info-light/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <ShoppingCart className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-info">Retail Account</p>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;re currently shopping at retail prices.{" "}
                <Link href="/apply" className="text-info font-medium underline underline-offset-2">
                  Apply for a wholesale account
                </Link>{" "}
                to unlock tiered discounts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "PENDING" && (
        <Card className="border-warning/30 bg-warning-light/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warning">Application Pending</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your wholesale application is under review. We&apos;ll notify you by email once a decision is made.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "DENIED" && (
        <Card className="border-danger/30 bg-danger-light/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-danger">Application Denied</p>
              <p className="text-sm text-muted-foreground mt-1">
                {account?.denialReason || "Your wholesale application was not approved."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Checklist */}
      {onboardingData && (
        <DashboardOnboarding
          profileComplete={onboardingData.profileComplete}
          hasResaleCert={onboardingData.hasResaleCert}
          browsedHotSellers={onboardingData.browsedHotSellers}
          hasOrders={onboardingData.hasOrders}
        />
      )}

      {/* Announcements Widget - above progress for all statuses */}
      {announcements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                Latest Announcements
              </CardTitle>
              <Link href="/announcements">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {announcements.map((a) => {
              const borderColor =
                a.priority === "urgent"
                  ? "border-l-red-500"
                  : a.priority === "important"
                    ? "border-l-yellow-500"
                    : "border-l-primary/30";
              return (
                <div
                  key={a.id}
                  className={`border-l-4 ${borderColor} pl-3 py-1`}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.priority === "urgent" && (
                      <Badge variant="destructive" className="text-[9px]">Urgent</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {a.body}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {status === "APPROVED" && (
        <ApprovedDashboardWrapper
          account={account!}
          activePromo={activePromo}
          pausedUpgrades={account!.pausedUpgrades}
          welcomeExpiresAt={account!.welcomeExpiresAt?.toISOString() ?? null}
          storeCredit={storeCredit}
        />
      )}
    </div>
  );
}

async function ApprovedDashboardWrapper({
  account,
  activePromo,
  pausedUpgrades,
  welcomeExpiresAt,
  storeCredit,
}: {
  account: {
    lastTier: string;
    lastCount7d: number;
    companyName: string;
    alias: string;
  };
  activePromo: { code: string; tier: string } | null;
  pausedUpgrades: boolean;
  welcomeExpiresAt: string | null;
  storeCredit: number;
}) {
  const tierDefs = await loadTiers();
  const welcomeConfig = await loadWelcomeConfig();
  const tierWindowDays = await loadTierWindowDays();
  const welcomeActive = welcomeExpiresAt ? isWelcomeActive(new Date(welcomeExpiresAt)) : false;
  // Which tier will activate when welcome ends: based on current rolling-window count and admin-defined tier ranges.
  // If count is below the first tier's min (e.g. < 5), earned is "NONE" → we pass null so no tier box shows "activates when welcome ends".
  const earnedRaw =
    account.lastTier === "WELCOME" && welcomeActive
      ? await tierFromCount(account.lastCount7d)
      : null;
  const earnedTierIdWhenWelcome =
    earnedRaw === "NONE" || earnedRaw === null ? null : earnedRaw;
  return (
    <ApprovedDashboard
      account={account}
      activePromo={activePromo}
      pausedUpgrades={pausedUpgrades}
      tierDefs={tierDefs}
      welcomeExpiresAt={welcomeActive ? welcomeExpiresAt : null}
      welcomeDiscount={welcomeConfig.discount}
      earnedTierIdWhenWelcome={earnedTierIdWhenWelcome}
      tierWindowDays={tierWindowDays}
      storeCredit={storeCredit}
    />
  );
}

function ApprovedDashboard({
  account,
  activePromo,
  pausedUpgrades,
  tierDefs,
  welcomeExpiresAt,
  welcomeDiscount,
  earnedTierIdWhenWelcome,
  tierWindowDays,
  storeCredit,
}: {
  account: {
    lastTier: string;
    lastCount7d: number;
    companyName: string;
    alias: string;
  };
  activePromo: { code: string; tier: string } | null;
  pausedUpgrades: boolean;
  tierDefs: TierDef[];
  welcomeExpiresAt: string | null;
  storeCredit: number;
  welcomeDiscount: number;
  earnedTierIdWhenWelcome: string | null;
  tierWindowDays: number;
}) {
  const tierWindowLabel = formatTierWindowLabel(tierWindowDays);

  // Build display tiers with min/max from sorted tier definitions
  const sorted = [...tierDefs].sort((a, b) => a.minOrders - b.minOrders);
  const tiers = sorted.map((t, i) => ({
    id: t.id,
    label: t.label,
    min: t.minOrders,
    max: i < sorted.length - 1 ? sorted[i + 1].minOrders - 1 : Infinity,
    discount: t.discount,
  }));

  // For WELCOME tier, compute earned tier for progress display
  let earnedTierIdx: number;
  if (account.lastTier === "WELCOME") {
    const sortedDesc = [...tiers].sort((a, b) => b.min - a.min);
    const earned = sortedDesc.find((t) => account.lastCount7d >= t.min);
    earnedTierIdx = earned ? tiers.findIndex((t) => t.id === earned.id) : -1;
  } else {
    earnedTierIdx = tiers.findIndex((t) => t.id === account.lastTier);
  }
  const currentTierIdx = earnedTierIdx;
  const currentTier = currentTierIdx >= 0 ? tiers[currentTierIdx] : null;
  const nextTier =
    (account.lastTier === "NONE" || (account.lastTier === "WELCOME" && currentTierIdx < 0))
      ? tiers[0] ?? null
      : currentTierIdx >= 0 && currentTierIdx < tiers.length - 1
        ? tiers[currentTierIdx + 1]
        : null;

  const count = account.lastCount7d;
  const targetOrders = nextTier ? nextTier.min : currentTier?.max || 0;
  const progress = nextTier ? Math.min((count / nextTier.min) * 100, 100) : 100;

  const isWelcomeTier = account.lastTier === "WELCOME";
  const promoTierConfig = activePromo
    ? isWelcomeTier
      ? { id: "WELCOME", label: `Welcome ${welcomeDiscount}% Off`, min: 0, max: 0, discount: welcomeDiscount }
      : tiers.find((t) => t.id === activePromo.tier) ?? null
    : null;

  return (
    <>
      {/* Welcome Discount Countdown */}
      {welcomeExpiresAt && (
        <Card className="border-purple-400/40 bg-gradient-to-r from-purple-50 to-fuchsia-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              <div className="bg-purple-100 rounded-full p-2.5 flex-shrink-0">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-purple-900">Welcome Discount Active!</h3>
                  <Badge className="bg-purple-600 text-white text-[10px]">
                    {welcomeDiscount}% Off
                  </Badge>
                </div>
                <p className="text-sm text-purple-700 mt-1">
                  Enjoy your exclusive welcome discount on all orders. Start placing orders now to build your tier and keep earning discounts after the welcome period ends!
                </p>
                <div className="mt-3">
                  <WelcomeCountdown expiresAt={welcomeExpiresAt} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon Code Section */}
      {activePromo && promoTierConfig ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              <div className="bg-success/10 rounded-full p-2.5 flex-shrink-0">
                <Ticket className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold">Your Wholesale Coupon</h3>
                  <Badge className="bg-success text-white text-[10px]">
                    {promoTierConfig.discount}% Off
                  </Badge>
                  {isWelcomeTier && (
                    <Badge className="bg-purple-600 text-white text-[10px]">
                      Welcome
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <code className="text-lg font-bold font-mono tracking-wider bg-white border border-success/30 rounded-lg px-4 py-2 text-success select-all">
                    {activePromo.code}
                  </code>
                  <CopyCouponButton code={activePromo.code} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use this code at checkout on theperfectpart.net. This is your exclusive wholesale discount &mdash; it cannot be combined with other promotions. This code is tracked via IP geo location and if shared will be terminated.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              <div className="bg-muted rounded-full p-2.5 flex-shrink-0">
                <Ticket className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">No Active Coupon</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Reach {tiers[0]?.min ?? 5} qualifying orders in {tierWindowLabel} to unlock your first coupon code ({tiers[0]?.label ?? "10% Off"}).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Credit */}
      {storeCredit > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 rounded-full p-2.5 flex-shrink-0">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-1">Store Credit Available</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-bold text-primary font-mono">
                    ${storeCredit.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">available to use</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Your store credit will automatically apply at checkout on theperfectpart.net.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manually Adjusted Notice */}
      {pausedUpgrades && currentTier && (
        <Card className="border-info/30 bg-info-light/10">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Lock className="h-4 w-4 text-info flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-info">Tier Manually Set by Admin</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your tier has been locked at <strong>{currentTier.label}</strong> by an administrator. Automatic tier recalculation is paused.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Your Progress (Last {tierWindowLabel})
          </CardTitle>
          <CardDescription>
            {count} / {targetOrders === Infinity ? "\u221E" : targetOrders} qualifying orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {nextTier && nextTier.min - count > 0 && !pausedUpgrades && (
            <p className="text-xs text-muted-foreground">
              {nextTier.min - count} more orders to unlock <strong>{nextTier.label}</strong>
            </p>
          )}
          {!nextTier && currentTier && (
            <p className="text-xs text-success font-medium">
              Maximum tier reached! ({currentTier.label})
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map((tier) => {
          const isActive = account.lastTier === tier.id;
          const activatesWhenWelcomeEnds =
            !!welcomeExpiresAt &&
            earnedTierIdWhenWelcome !== null &&
            earnedTierIdWhenWelcome === tier.id &&
            account.lastTier === "WELCOME";
          const isAchieved =
            !activatesWhenWelcomeEnds &&
            (tiers.indexOf(tier) <= tiers.findIndex((t) => t.id === account.lastTier) ||
              (account.lastTier === "WELCOME" && count >= tier.min));

          return (
            <Card
              key={tier.id}
              className={`transition-all ${
                isActive
                  ? "border-primary shadow-md ring-1 ring-primary/20"
                  : activatesWhenWelcomeEnds
                    ? "border-purple-400/50 shadow-md ring-1 ring-purple-400/20 bg-gradient-to-b from-purple-50/50 to-transparent dark:from-purple-950/20"
                    : isAchieved
                      ? "border-success/30"
                      : "opacity-50"
              }`}
            >
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    variant={
                      isActive
                        ? "default"
                        : activatesWhenWelcomeEnds
                          ? "secondary"
                          : isAchieved
                            ? "secondary"
                            : "outline"
                    }
                    className={`text-[10px] ${activatesWhenWelcomeEnds ? "bg-purple-600 text-white border-0" : ""}`}
                  >
                    {isActive
                      ? "Current Tier"
                      : activatesWhenWelcomeEnds
                        ? "Activates when welcome ends"
                        : isAchieved
                          ? "Unlocked"
                          : "Locked"}
                  </Badge>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isActive ? "bg-primary" : activatesWhenWelcomeEnds ? "bg-purple-500" : isAchieved ? "bg-success" : "bg-muted"
                    }`}
                  />
                </div>
                <h3 className="text-2xl font-bold">{tier.discount}% Off</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {tier.min}&ndash;{tier.max === Infinity ? "\u221E" : tier.max} orders / {tierWindowLabel}
                </p>
                {activatesWhenWelcomeEnds && welcomeExpiresAt && (
                  <div className="mt-2">
                    <TierActivatesCountdown expiresAt={welcomeExpiresAt} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  + Free Flat Rate Shipping (US only)
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-warning/30 bg-warning-light/30">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">US Orders Only</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Discounts and free shipping apply only to US orders.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-info/30 bg-info-light/30">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <Package className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-info">Flat Rate Shipping Only</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Free shipping applies to &quot;Flat Rate&quot; method only.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
