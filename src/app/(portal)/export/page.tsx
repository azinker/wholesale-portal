import { db } from "@/lib/db";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { loadChannelSetup } from "@/lib/shopify-channel/setup";
import { CopyCouponButton } from "../dashboard/copy-coupon-button";
import { Tip } from "../tip";
import { ChannelSetupGate } from "../channel-setup-gate";
import { ChannelHeading, ChannelPage, ChannelPanel } from "../channel-ui";
import { ExportBoard } from "./export-board";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ ready?: string }>;
}) {
  const { account } = await requireChannelAccount();
  const setup = await loadChannelSetup(account.id);
  if (!setup.ready) {
    return (
      <ChannelSetupGate
        setup={setup}
        title="Export listings"
        lede="This download puts the catalog on your own site. It stays hidden until the terms, a card, and a Shopify store are finished."
      />
    );
  }
  const params = await searchParams;
  const promo = await db.promotionRecord.findFirst({
    where: { accountId: account.id, enabled: true },
    select: { code: true },
  });
  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify"
        title="Export listings"
        lede="Download the catalog to put products on your own site. This file does not connect orders."
      />
      <ChannelPanel className="px-5 py-4 text-sm leading-6 text-[#3f3a38]">
        <p className="inline-flex items-center gap-1.5 font-semibold">
          How ordering works
          <Tip text="The zip has listings.csv, how-to-use.csv, and an images folder. Each product has its own folder inside images, named with the product title. Your SKU column starts blank so you can type your own." />
        </p>
        <p className="mt-1">
          This export is for getting the catalog onto your site. There is no connection. A sale on your site does not order from us by itself.
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
          Your SKU and your selling price start blank. Type your own before you import the file. Wholesale cost is filled in at your discount today. If the export takes a minute, the bar shows the progress, and we email you when the file is ready.
        </p>
      </ChannelPanel>
      <ExportBoard readyId={params.ready || undefined} />
    </ChannelPage>
  );
}
