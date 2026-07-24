import { redirect } from "next/navigation";
import { AlertCircle, ExternalLink, Link2, MessageSquareText, Share2, Ticket } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyCouponButton } from "../dashboard/copy-coupon-button";

const AWIN_LINK_PLACEHOLDER = "[your AWIN tracking link]";

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
  const shopLink = awinLink || AWIN_LINK_PLACEHOLDER;
  const copy = promo
    ? `Save ${discount}% at The Perfect Part with code ${promo.code}. Shop here: ${shopLink}`
    : "";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Share2 className="h-6 w-6 text-primary" /> Share Kit
        </h1>
        <p className="mt-1 text-muted-foreground">
          Two things to publish together: your AWIN tracking link, and your audience discount code.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardContent className="flex gap-3 py-5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">How it works</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your AWIN link tracks commission. Your audience code gives shoppers the discount.
              Use both in the same post or placement, and always include a clear affiliate disclosure.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <ResourceCard
          icon={Link2}
          title="Your AWIN tracking link"
          description="Get this from your AWIN account — not from this portal."
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Log in to AWIN and open The Perfect Part programme.</li>
              <li>Copy your tracking link (or create one with Link Builder).</li>
              <li>Use that link as the clickable destination in every placement.</li>
            </ol>
            <p>
              Any valid AWIN tracking link for The Perfect Part works. You do not need a special link from us.
            </p>
            {awinLink ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-foreground">Optional shortcut</p>
                <p className="text-xs">
                  Because we have your AWIN publisher ID on file, here is a ready-made homepage link you can use:
                </p>
                <p className="truncate rounded border bg-background p-2 font-mono text-xs text-foreground">
                  {awinLink}
                </p>
                <div className="flex gap-2">
                  <CopyCouponButton code={awinLink} label="Copy Link" />
                  <Button variant="outline" size="sm" asChild>
                    <a href={awinLink} target="_blank" rel="noopener noreferrer">
                      Test <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </ResourceCard>

        <ResourceCard
          icon={Ticket}
          title="Audience discount code"
          description="This is what you get from us. Show it clearly next to the offer."
        >
          {promo ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded border bg-muted px-4 py-2 text-lg font-bold">{promo.code}</code>
                <CopyCouponButton code={promo.code} />
              </div>
              <p className="text-sm text-muted-foreground">
                Shoppers enter this code at checkout for {discount}% off. Pair it with your AWIN link so you still get tracked.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your audience code is being prepared.</p>
          )}
        </ResourceCard>
      </div>

      <ResourceCard
        icon={MessageSquareText}
        title="Ready-to-use copy"
        description={
          awinLink
            ? "Copy this as-is, or adapt it for your channel."
            : `Replace ${AWIN_LINK_PLACEHOLDER} with the tracking link from your AWIN account before posting.`
        }
      >
        {copy ? (
          <>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">{copy}</div>
            <div className="mt-3">
              <CopyCouponButton code={copy} label="Copy Message" />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Copy will appear once your audience code is active.</p>
        )}
      </ResourceCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publishing checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Use your AWIN tracking link (from AWIN) as the clickable destination.</li>
            <li>Show the current audience code and discount percentage beside the offer.</li>
            <li>Add a clear disclosure such as “I may earn a commission from qualifying purchases.”</li>
            <li>Do not promise tax-free pricing or free shipping; retail checkout rules apply.</li>
            <li>When your tier changes, replace the disabled code across every live placement.</li>
            <li>Verify price, inventory, and offer details before publishing.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
