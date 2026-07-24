import { redirect } from "next/navigation";
import { AlertCircle, ExternalLink, Link2, MessageSquareText, Share2, Ticket } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyCouponButton } from "../dashboard/copy-coupon-button";

export default async function ShareKitPage() {
  const user = await getUser();
  if (!user) redirect("/");
  const account = user.wholesaleAccount;
  if (!account || account.partnerType !== "AFFILIATE_PUBLISHER") redirect("/dashboard");

  const promo = await db.promotionRecord.findFirst({
    where: { accountId: account.id, enabled: true, promoKind: "PUBLISHER_AUDIENCE" },
    select: { code: true, tier: true },
  });
  const discount = Number((promo?.tier || account.lastTier).replace(/\D/g, "")) || 15;
  const awinLink = account.awinPublisherId
    ? `https://www.awin1.com/cread.php?awinmid=121802&awinaffid=${encodeURIComponent(account.awinPublisherId)}&ued=${encodeURIComponent("https://theperfectpart.net")}`
    : null;
  const copy = promo
    ? `Save ${discount}% at The Perfect Part with code ${promo.code}. Shop here: ${awinLink || "YOUR_AWIN_LINK"}`
    : "";

  return (
    <div className="max-w-4xl space-y-6">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Share2 className="h-6 w-6 text-primary" /> Share Kit</h1><p className="mt-1 text-muted-foreground">Everything you need to publish a clear, trackable offer.</p></div>
      <Card className="border-primary/30 bg-primary/[0.03]"><CardContent className="flex gap-3 py-5"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Link + code = commission tracking + audience savings</p><p className="mt-1 text-sm text-muted-foreground">Lead with your AWIN link and include your audience code in the same placement. Always include a clear affiliate disclosure.</p></div></CardContent></Card>
      <div className="grid gap-5 md:grid-cols-2">
        <ResourceCard icon={Link2} title="AWIN tracking link" description="Use this as the destination URL for every placement.">
          {awinLink ? <><p className="truncate rounded border bg-muted p-2 font-mono text-xs">{awinLink}</p><div className="mt-3 flex gap-2"><CopyCouponButton code={awinLink} label="Copy Link" /><Button variant="outline" size="sm" asChild><a href={awinLink} target="_blank" rel="noopener noreferrer">Test <ExternalLink className="h-3 w-3" /></a></Button></div></> : <p className="text-sm text-muted-foreground">Contact partner support to add or confirm your AWIN publisher ID.</p>}
        </ResourceCard>
        <ResourceCard icon={Ticket} title="Audience discount code" description="Display this code clearly beside the offer.">
          {promo ? <div className="flex flex-wrap items-center gap-3"><code className="rounded border bg-muted px-4 py-2 text-lg font-bold">{promo.code}</code><CopyCouponButton code={promo.code} /></div> : <p className="text-sm text-muted-foreground">Your audience code is being prepared.</p>}
        </ResourceCard>
      </div>
      <ResourceCard icon={MessageSquareText} title="Ready-to-use copy" description="Adapt this language to your channel while keeping the offer accurate.">
        {copy ? <><div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">{copy}</div><div className="mt-3"><CopyCouponButton code={copy} label="Copy Message" /></div></> : <p className="text-sm text-muted-foreground">Copy will appear once your audience code is active.</p>}
      </ResourceCard>
      <Card><CardHeader><CardTitle className="text-base">Publishing checklist</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>Use the AWIN link as the clickable destination.</li><li>Show the current audience code and discount percentage.</li><li>Add a clear disclosure such as “I may earn a commission from qualifying purchases.”</li><li>Do not promise tax-free pricing or free shipping; retail checkout rules apply.</li><li>When your tier changes, replace the disabled code across every live placement.</li><li>Verify price, inventory, and offer details before publishing.</li></ul></CardContent></Card>
    </div>
  );
}

function ResourceCard({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>;
}
