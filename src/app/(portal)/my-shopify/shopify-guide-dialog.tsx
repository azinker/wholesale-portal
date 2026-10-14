"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const SHOPIFY_GUIDE = {
  kicker: "Shopify",
  title: "Connect your Shopify store",
  intro: "Your customer pays you on your store. We charge your card, then ship the order to them.",
  video: "/guides/shopify-connection.mp4",
  href: "/my-shopify",
  action: "Open Shopify",
  steps: [
    { text: "On this dashboard, open Shopify in the menu." },
    { text: "Accept the terms. An owner or an admin does this once." },
    { text: "Open Billing and save a card. This is the card we charge when your customer pays you." },
    { text: "Store credit is used first. Your card pays the rest. We charge your wholesale price, not the price your customer paid you." },
    { text: "Type your store address. It ends in .myshopify.com. Pasting the full link is fine. Shopify asks you to approve it. After you approve, the store is connected. You can connect up to 5 stores. Each store needs to use US dollars." },
    { text: "Open Catalog. Pick a product. Add it to Shopify. You choose the price your customer pays. We update how many are in stock. We do not change your price." },
    { text: "When a customer pays on your Shopify store, the order shows under Orders. We ship to the address they entered. It usually goes out within 1 business day. Weekends and USPS holidays are not shipping days. Tracking shows when it ships." },
    { text: "Shipping in the US is free, including PO Boxes, Alaska, and Hawaii. Outside the US, including Canada, shipping is $18.99 once per order. There is no tax." },
  ],
  notes: [
    "If a product is out of stock, we email you. We do not charge your card, and we do not ship that sale later. Refund your customer in Shopify.",
    "If you pause the store, customers can still buy on Shopify. We do not charge your card and we do not ship those sales. You handle them. When you resume, only new sales are charged and shipped.",
    "After we charge the card, changing the order in Shopify does not change what we ship. For an address change, open Support.",
    "If we refund our charge, that money goes back to your card. It does not refund the customer who paid you on Shopify. Refund them in Shopify if they need their money back.",
    "You can put your own product code on Shopify. We match the product you added.",
    "Export listings is a spreadsheet. It does not connect your store. Those sales are still placed on theperfectpart.net with your dashboard email and coupon.",
  ],
};

export function ShopifyGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#9c2126] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8282E] focus-visible:ring-offset-2">
        Help Guide Me
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{SHOPIFY_GUIDE.title}</DialogTitle>
          <DialogDescription>{SHOPIFY_GUIDE.intro}</DialogDescription>
        </DialogHeader>
        <video
          controls
          playsInline
          preload="metadata"
          className="mt-4 aspect-video w-full rounded-xl bg-[#1a1a1a]"
          src={SHOPIFY_GUIDE.video}
        />
        <ol className="mt-4 space-y-3">
          {SHOPIFY_GUIDE.steps.map((step, index) => (
            <li key={step.text} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {index + 1}
              </span>
              <p className="min-w-0 pt-0.5 text-sm leading-6 text-[#3f3a38]">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl bg-[#f6f3f1] px-4 py-4">
          <p className="text-sm font-semibold text-[#1a1a1a]">Good to know</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#5c5654]">
            {SHOPIFY_GUIDE.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
