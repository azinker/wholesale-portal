import Link from "next/link";
import { Check } from "lucide-react";
import { SHOPIFY_CONNECT_MAINTENANCE } from "@/lib/shopify-channel/constants";
import type { ChannelSetup } from "@/lib/shopify-channel/setup";
import { ChannelHeading, ChannelPage, ChannelPanel, channelPrimaryBtn } from "./channel-ui";
import { ShopifyMaintenanceModal } from "./shopify-maintenance-modal";

const STEPS = [
  {
    key: "terms" as const,
    title: "Agree to the terms",
    body: "Read what we charge, how shipping works, and how refunds work.",
    href: "/my-shopify#terms",
    action: "Review terms",
  },
  {
    key: "card" as const,
    title: "Save a credit card",
    body: "We charge this card when your customer pays. We never charge your customer.",
    href: "/billing",
    action: "Add a card",
  },
  {
    key: "store" as const,
    title: "Connect your Shopify store",
    body: SHOPIFY_CONNECT_MAINTENANCE
      ? "Connecting a store is under maintenance. Catalog and orders open again after that is fixed."
      : "Connect the store, up to 5. Products, stock, and orders stay hidden until this is done.",
    href: "/my-shopify#connect",
    action: SHOPIFY_CONNECT_MAINTENANCE ? "See status" : "Connect Shopify",
  },
];

function doneFor(setup: ChannelSetup, key: (typeof STEPS)[number]["key"]): boolean {
  if (key === "terms") return setup.terms;
  if (key === "card") return Boolean(setup.cardLast4);
  return setup.stores.length > 0;
}

export function ChannelSetupGate({
  setup,
  title,
  lede,
}: {
  setup: ChannelSetup;
  title: string;
  lede: string;
}) {
  const firstOpen = STEPS.find((step) => !doneFor(setup, step.key));
  return (
    <ChannelPage>
      {SHOPIFY_CONNECT_MAINTENANCE && <ShopifyMaintenanceModal />}
      <ChannelHeading kicker="Shopify" title={title} lede={lede} />
      <ChannelPanel className="px-5 py-5">
        <p className="font-semibold text-[#1a1a1a]">Finish these three steps first</p>
        <p className="mt-1 text-sm leading-6 text-[#5c5654]">
          This page stays closed until the terms are agreed, a card is saved, and a Shopify store is connected.
        </p>
        <ol className="mt-5 space-y-3">
          {STEPS.map((step, index) => {
            const done = doneFor(setup, step.key);
            const current = firstOpen?.key === step.key;
            return (
              <li key={step.key} className="flex items-start gap-3 rounded-2xl border border-[#f0ebe8] bg-[#fbfaf9] px-4 py-4">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-600 text-white" : current ? "bg-[#2d2d2d] text-white" : "bg-white text-[#5c5654]"}`}>
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1a1a1a]">
                    {step.title}
                    {step.key === "card" && setup.cardLast4 ? ` ···· ${setup.cardLast4}` : ""}
                    {step.key === "store" && setup.hasStore && !done ? " · one more check" : ""}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#5c5654]">{done ? "Done." : step.body}</p>
                </div>
                {!done && (
                  <Link href={step.href} className={current ? channelPrimaryBtn : "inline-flex cursor-pointer items-center text-sm font-semibold text-[#1a1a1a] underline-offset-2 hover:underline"}>
                    {step.action}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </ChannelPanel>
    </ChannelPage>
  );
}
