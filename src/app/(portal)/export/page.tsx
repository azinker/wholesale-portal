import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CopyCouponButton } from "../dashboard/copy-coupon-button";
import { Tip } from "../tip";
import { ChannelHeading, ChannelPage, ChannelPanel } from "../channel-ui";
import { ExportBoard } from "./export-board";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ ready?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/");
  const account = user.wholesaleAccount;
  if (!account || account.status !== "APPROVED" || account.partnerType === "AFFILIATE_PUBLISHER") notFound();
  const params = await searchParams;
  const promo = await db.promotionRecord.findFirst({
    where: { accountId: account.id, enabled: true },
    select: { code: true },
  });
  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Listings"
        title="Export listings"
        lede="Download the catalog for your own site. This works without Shopify. Pick Manual, Shopify, BigCommerce, or WooCommerce."
      />
      <ChannelPanel className="px-5 py-4 text-sm leading-6 text-[#3f3a38]">
        <p className="inline-flex items-center gap-1.5 font-semibold">
          How ordering works
          <Tip text="The zip has listings.csv, how-to-use.csv, and an images folder. Each product has its own folder inside images, named with the product title. Your SKU starts blank so you can type your own. Manual is a simple spreadsheet. The other choices use that site's import columns." />
        </p>
        <p className="mt-1">
          This export puts the catalog on your site, whether that site is Shopify, BigCommerce, WooCommerce, or something else. There is no connection. A sale on your site does not order from us by itself.
        </p>
        <p className="mt-2 text-[#5c5654]">
          When a customer buys from you, place that order on <strong>www.theperfectpart.net</strong>. Sign in with <strong>{account.email}</strong>, the same email as this dashboard
          {promo?.code ? (
            <>
              , and enter <span className="font-mono font-semibold text-[#3f3a38]">{promo.code}</span> at checkout.
            </>
          ) : (
            ". Your coupon shows on your dashboard once your account qualifies. Enter that code at checkout."
          )}
        </p>
        {promo?.code && (
          <div className="mt-3">
            <CopyCouponButton code={promo.code} />
          </div>
        )}
        <p className="mt-3 text-[#5c5654]">
          Manual leaves your selling price blank. Shopify, BigCommerce, and WooCommerce fill the price with today's site price so the file can import. Change that price to what you charge before you import. Your SKU stays blank. Wholesale cost is filled in at your discount today.
        </p>
      </ChannelPanel>
      <ExportBoard readyId={params.ready || undefined} />
    </ChannelPage>
  );
}
