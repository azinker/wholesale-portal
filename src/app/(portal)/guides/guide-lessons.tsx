import Link from "next/link";

type Step = {
  text: string;
  lines?: string[];
};

function Lesson({
  id,
  kicker,
  title,
  intro,
  video,
  steps,
  notes,
  href,
  action,
}: {
  id: string;
  kicker: string;
  title: string;
  intro: string;
  video: string;
  steps: Step[];
  notes: string[];
  href: string;
  action: string;
}) {
  const button = href.startsWith("http") ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
      {action}
    </a>
  ) : (
    <Link href={href} className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
      {action}
    </Link>
  );

  return (
    <article id={id} className="flex h-full scroll-mt-24 flex-col rounded-2xl border border-[#e7e1de] bg-white p-4 shadow-[0_10px_30px_rgba(45,45,45,0.04)] md:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{kicker}</p>
      <h2 className="mt-1.5 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#5c5654]">{intro}</p>
      <video
        controls
        playsInline
        preload="metadata"
        className="mt-4 aspect-video w-full rounded-xl bg-[#1a1a1a]"
        src={video}
      />
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.text} className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {index + 1}
            </span>
            <div className="min-w-0 text-sm leading-6 text-[#3f3a38]">
              <p>{step.text}</p>
              {step.lines && (
                <ul className="mt-2 space-y-1.5 text-[#5c5654]">
                  {step.lines.map((line) => (
                    <li key={line} className="pl-1">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      {notes.length > 0 && (
        <div className="mt-6 rounded-xl bg-[#f6f3f1] px-4 py-4">
          <p className="text-sm font-semibold text-[#1a1a1a]">Good to know</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#5c5654]">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5">{button}</div>
    </article>
  );
}

const WEBSITE_STEPS: Step[] = [
  {
    text: "Open www.theperfectpart.net.",
  },
  {
    text: "Sign in with the same email you use on this dashboard. That email is the one that carries your discount. A different signed-in email will not use your coupon.",
  },
  {
    text: "Your coupon is the green code on your dashboard. It is yours. Enter that code at checkout.",
  },
  {
    text: "Pick the item you want us to ship. The address you type at checkout is where the package goes. Put your customer's address there.",
  },
  {
    text: "The product price drops. There is no tax. The discount applies to the product price. It does not apply to shipping.",
  },
  {
    text: "Shipping in the United States is free. That includes PO Boxes, Alaska, and Hawaii.",
  },
  {
    text: "Outside the United States, including Canada, shipping is $18.99 one time for the order. Your product discount still applies.",
  },
  {
    text: "If you have store credit, we use that first. Then you pay whatever is left.",
  },
  {
    text: "The order shows on this dashboard. We pack it and ship on a business day. Weekends and USPS holidays are not shipping days. Tracking shows here when it ships.",
  },
];

const SHOPIFY_STEPS: Step[] = [
  {
    text: "On this dashboard, open Shopify in the menu.",
  },
  {
    text: "Accept the terms. An owner or an admin does this once.",
  },
  {
    text: "Open Billing and save a card. This is the card we charge when your customer pays you.",
  },
  {
    text: "Store credit is used first. Your card pays the rest. We charge your wholesale price, not the price your customer paid you.",
  },
  {
    text: "Type your store address. It ends in .myshopify.com. Pasting the full link is fine. Shopify asks you to approve it. After you approve, the store is connected. You can connect up to 5 stores. Each store needs to use US dollars.",
  },
  {
    text: "Open Catalog. Pick a product. Add it to Shopify. You choose the price your customer pays. We update how many are in stock. We do not change your price.",
  },
  {
    text: "When a customer pays on your Shopify store, the order shows under Orders. We ship to the address they entered. It usually goes out within 1 business day. Weekends and USPS holidays are not shipping days. Tracking shows when it ships.",
  },
  {
    text: "Shipping in the US is free, including PO Boxes, Alaska, and Hawaii. Outside the US, including Canada, shipping is $18.99 once per order. There is no tax.",
  },
];

export function GuideLessons({ shopify }: { shopify: boolean }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Start here</p>
        <h2 className="font-display text-2xl font-semibold">How it works</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5654]">
          Watch the short video, then follow the steps under it. If you set this up today, start with the first one.
        </p>
      </div>
      <div className={shopify ? "grid items-start gap-4 lg:grid-cols-2" : "max-w-xl"}>
      <Lesson
        id="buy-for-your-customer"
        kicker="Our website"
        title="Buy it for your customer"
        intro="You place the order on our website. We ship it to the address you enter."
        video="/guides/buy-for-your-customer.mp4"
        steps={WEBSITE_STEPS}
        notes={[
          "Your coupon is on your dashboard. Enter it at checkout on theperfectpart.net.",
          "Store credit on your account is used automatically at that checkout, before you pay.",
          "We ship to the address you type. Use your customer's address when the package should go to them.",
        ]}
        href="https://theperfectpart.net"
        action="Open the store"
      />
      {shopify && (
        <Lesson
          id="shopify"
          kicker="Shopify"
          title="Connect your Shopify store"
          intro="Your customer pays you on your store. We charge your card, then ship the order to them."
          video="/guides/shopify-connection.mp4"
          steps={SHOPIFY_STEPS}
          notes={[
            "If a product is out of stock, we email you. We do not charge your card, and we do not ship that sale later. Refund your customer in Shopify.",
            "If you pause the store, customers can still buy on Shopify. We do not charge your card and we do not ship those sales. You handle them. When you resume, only new sales are charged and shipped.",
            "After we charge the card, changing the order in Shopify does not change what we ship. For an address change, open Support.",
            "If we refund our charge, that money goes back to your card. It does not refund the customer who paid you on Shopify. Refund them in Shopify if they need their money back.",
            "You can put your own product code on Shopify. We match the product you added.",
            "Export listings is a spreadsheet. It does not connect your store. Those sales are still placed on theperfectpart.net with your dashboard email and coupon.",
          ]}
          href="/my-shopify"
          action="Open Shopify"
        />
      )}
      </div>
    </section>
  );
}
