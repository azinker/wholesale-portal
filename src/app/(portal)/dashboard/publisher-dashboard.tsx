import Link from "next/link";
import { AlertCircle, ArrowRight, BarChart3, CheckCircle2, ExternalLink, Link2, Share2, Ticket, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyCouponButton } from "./copy-coupon-button";
import { loadPublisherTierConfig } from "@/lib/publisher-tier-engine";

interface PublisherAccount {
  id: string;
  companyName: string;
  status: string;
  lastTier: string;
  lastCount14d: number;
  awinPublisherId: string | null;
  promoWebsite: string | null;
  onboardingDismissed: boolean;
}

export async function PublisherDashboard({ account }: { account: PublisherAccount }) {
  if (account.status !== "APPROVED") {
    return (
      <div className="max-w-4xl space-y-6">
        <div><h1 className="text-2xl font-bold">Publisher Dashboard</h1><p className="mt-1 text-muted-foreground">Welcome, {account.companyName}</p></div>
        <Card className="border-warning/30 bg-warning-light/20">
          <CardContent className="flex gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div><p className="font-semibold">Publisher application {account.status.toLowerCase()}</p><p className="mt-1 text-sm text-muted-foreground">We&apos;ll email you when review is complete.</p></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [promo, recentOrders, tierConfig] = await Promise.all([
    db.promotionRecord.findFirst({
      where: { accountId: account.id, enabled: true, promoKind: "PUBLISHER_AUDIENCE" },
      select: { code: true, tier: true },
    }),
    db.publisherOrderAttribution.findMany({
      where: { accountId: account.id },
      orderBy: { orderDate: "desc" },
      take: 5,
    }),
    loadPublisherTierConfig(),
  ]);

  const publisherTiers = [...tierConfig.tiers].sort((a, b) => a.minOrders - b.minOrders);
  const tier = publisherTiers.find((item) => item.id === account.lastTier) ?? publisherTiers[0];
  const tierIndex = publisherTiers.findIndex((item) => item.id === tier.id);
  const nextTier = publisherTiers[tierIndex + 1] ?? null;
  const progress = nextTier ? Math.min((account.lastCount14d / nextTier.minOrders) * 100, 100) : 100;
  const awinLink = account.awinPublisherId
    ? `https://www.awin1.com/cread.php?awinmid=121802&awinaffid=${encodeURIComponent(account.awinPublisherId)}&ued=${encodeURIComponent("https://theperfectpart.net")}`
    : null;

  return (
    <div className="max-w-5xl space-y-7">
      <div>
        <Badge className="mb-3">Affiliate Publisher</Badge>
        <h1 className="text-2xl font-bold">Publisher Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Welcome back, {account.companyName}</p>
      </div>

      {!account.onboardingDismissed && (
        <Card>
          <CardHeader><CardTitle className="text-base">Publisher onboarding</CardTitle><CardDescription>Complete these steps before sharing your first offer.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ChecklistItem done={!!account.promoWebsite} label="Confirm your promotion website" href="/profile" />
            <ChecklistItem done={!!account.awinPublisherId} label="Confirm your AWIN publisher ID" href="/support" />
            <ChecklistItem done={!!promo} label="Copy your audience code" href="/share-kit" />
            <ChecklistItem done={recentOrders.length > 0} label="Receive your first attributed order" href="/performance" />
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardContent className="flex items-start gap-3 py-5">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Always share your AWIN link and audience code together</p>
            <p className="mt-1 text-sm text-muted-foreground">The AWIN link attributes eligible commission. The code gives your audience the discount; a code alone does not guarantee commission tracking.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4 text-primary" /> Active audience code</CardTitle></CardHeader>
          <CardContent>
            {promo ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-lg border bg-muted px-4 py-2 text-lg font-bold">{promo.code}</code>
                  <CopyCouponButton code={promo.code} />
                  <Badge variant="secondary">{tier.discount}% off</Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Public sharing is encouraged. Replace this code everywhere when your tier changes.</p>
              </>
            ) : <p className="text-sm text-muted-foreground">Your P15 audience code is being prepared. Contact support if it does not appear shortly.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ExternalLink className="h-4 w-4 text-primary" /> AWIN tracking link</CardTitle></CardHeader>
          <CardContent>
            {awinLink ? (
              <>
                <p className="truncate rounded-lg border bg-muted px-3 py-2 font-mono text-xs">{awinLink}</p>
                <div className="mt-3 flex gap-2"><CopyCouponButton code={awinLink} label="Copy Link" /><Button variant="outline" size="sm" asChild><a href={awinLink} target="_blank" rel="noopener noreferrer">Open <ExternalLink className="h-3 w-3" /></a></Button></div>
              </>
            ) : (
              <div><p className="text-sm text-muted-foreground">Ask partner support to add or confirm your AWIN publisher ID and generate your tracking link.</p><Button asChild size="sm" className="mt-3"><Link href="/support">Contact support</Link></Button></div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Audience tier progress</CardTitle>
          <CardDescription>{account.lastCount14d} attributed order{account.lastCount14d === 1 ? "" : "s"} in the rolling {tierConfig.windowDays}-day window</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex justify-between text-sm"><strong>{tier.discount}% audience discount</strong>{nextTier ? <span>{Math.max(nextTier.minOrders - account.lastCount14d, 0)} orders to {nextTier.discount}%</span> : <span className="text-success">Maximum tier reached</span>}</div>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {publisherTiers.map((item) => <div key={item.id} className={`rounded-lg border p-3 text-center ${item.id === tier.id ? "border-primary bg-primary/5" : ""}`}><strong>{item.discount}%</strong><p className="text-xs text-muted-foreground">{item.minOrders}+ orders</p></div>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> Recent attributed orders</CardTitle><CardDescription>Latest coupon-attributed activity</CardDescription></div><Button variant="ghost" size="sm" asChild><Link href="/performance">View all <ArrowRight className="h-3 w-3" /></Link></Button></CardHeader>
        <CardContent>
          {recentOrders.length ? <div className="divide-y rounded-lg border">{recentOrders.map((order) => <div key={order.id} className="flex items-center justify-between px-4 py-3 text-sm"><div><strong>Order #{order.orderId}</strong><p className="text-xs text-muted-foreground">{order.orderDate.toLocaleDateString()}</p></div><span className="font-mono text-xs">{order.couponCode}</span></div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">No attributed orders yet. Use your AWIN link and audience code together in your first placement.</p>}
        </CardContent>
      </Card>

      <Card className="border-dashed"><CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center"><div className="flex gap-3"><Share2 className="h-5 w-5 text-primary" /><div><p className="font-semibold">Ready-made sharing resources</p><p className="text-sm text-muted-foreground">Copy compliant offer text and placement guidance.</p></div></div><Button asChild><Link href="/share-kit">Open Share Kit</Link></Button></CardContent></Card>
    </div>
  );
}

function ChecklistItem({ done, label, href }: { done: boolean; label: string; href: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/40"><CheckCircle2 className={`h-5 w-5 ${done ? "text-success" : "text-muted-foreground"}`} /><span className={done ? "text-muted-foreground line-through" : "font-medium"}>{label}</span></Link>;
}
