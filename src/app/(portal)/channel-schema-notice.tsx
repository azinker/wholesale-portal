import Link from "next/link";
import { ChannelPage, ChannelPanel } from "./channel-ui";

export function ChannelSchemaNotice() {
  return (
    <ChannelPage>
      <ChannelPanel className="px-6 py-8">
        <h1 className="font-display text-2xl font-semibold">Your Shopify pages</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#5c5654]">
          We're getting these pages ready. Please check back in a few minutes.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Back to the dashboard
        </Link>
      </ChannelPanel>
    </ChannelPage>
  );
}
