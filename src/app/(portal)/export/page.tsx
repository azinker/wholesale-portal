import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { Tip } from "../tip";
import { ChannelHeading, ChannelPage, ChannelPanel } from "../channel-ui";
import { ExportBoard } from "./export-board";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ ready?: string }>;
}) {
  await requireChannelAccount();
  const params = await searchParams;
  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify"
        title="Export listings"
        lede="Download products as a spreadsheet and a folder of pictures. Use it for any sales channel besides the Shopify connection."
      />
      <ChannelPanel className="px-5 py-4 text-sm leading-6 text-[#3f3a38]">
        <p className="inline-flex items-center gap-1.5 font-semibold">
          What you get
          <Tip text="The zip has listings.csv, how-to-use.csv, and an images folder. Your SKU column is blank. Fill in your own. Our product codes are not in the file." />
        </p>
        <p className="mt-1 text-[#5c5654]">
          Your SKU and your selling price start blank. Type your own before you import the file. Wholesale cost is filled in at your discount today. If the export takes a minute, the bar shows the progress, and we email you when the file is ready.
        </p>
      </ChannelPanel>
      <ExportBoard readyId={params.ready || undefined} />
    </ChannelPage>
  );
}
