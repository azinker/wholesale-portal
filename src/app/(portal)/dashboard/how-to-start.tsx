import Link from "next/link";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { CopyCouponButton } from "./copy-coupon-button";

function PathCard({
  kicker,
  title,
  body,
  href,
  action,
}: {
  kicker: string;
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  const className = "flex h-full flex-col rounded-2xl border border-[#e7e1de] bg-white p-5 shadow-[0_10px_30px_rgba(45,45,45,0.04)] transition-colors duration-200 hover:border-[#d7ccc7]";
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{kicker}</p>
      <h3 className="mt-2 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-[#5c5654]">{body}</p>
      <span className="mt-4 text-sm font-semibold text-primary">{action}</span>
    </>
  );
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

export async function HowToStart({
  email,
  couponCode,
}: {
  email: string;
  couponCode: string | null;
}) {
  const channel = await channelVisibility(email);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Start here</p>
        <h2 className="font-display text-2xl font-semibold">Pick a way to sell</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5654]">
          {channel.visible
            ? "Buy on our website, sell on your own Shopify store, or download a spreadsheet for another sales channel. You can use more than one."
            : "Buy on our website with your discount code. Sign in with the same email you use here."}
        </p>
      </div>
      <div className={channel.visible ? "grid gap-3 lg:grid-cols-3" : "grid gap-3 lg:grid-cols-1"}>
        <PathCard
          kicker="Our website"
          title="Buy it yourself"
          body="Shop on theperfectpart.net. Your code applies your wholesale price, free US shipping, and no tax. We ship to you."
          href="https://theperfectpart.net"
          action="Open the store"
        />
        {channel.visible && (
          <>
            <PathCard
              kicker="Shopify"
              title="Sell on your store"
              body="Your customer pays you on Shopify. We charge the card you save here and ship the order to them."
              href="/my-shopify"
              action="Open Shopify"
            />
            <PathCard
              kicker="Spreadsheet"
              title="Export listings"
              body="Download the catalog for Shopify, BigCommerce, WooCommerce, or a simple spreadsheet. Orders still go through theperfectpart.net with your wholesale email and coupon."
              href="/export"
              action="Export products"
            />
          </>
        )}
      </div>
      <div className="rounded-2xl border border-[#e7e1de] bg-white px-5 py-4 text-sm leading-6 text-[#3f3a38]">
        <p>
          On theperfectpart.net, sign in as <strong>{email}</strong>
          {couponCode ? (
            <>
              {" "}and enter <span className="font-mono font-semibold">{couponCode}</span> at checkout.
            </>
          ) : (
            ". Your discount code shows here once your account qualifies."
          )}
        </p>
        <p className="mt-1 text-[#5c5654]">
          The usual mix-up is a store window signed in with a different email. Sign out, sign back in with this email, then enter the code.
        </p>
        {couponCode && (
          <div className="mt-3">
            <CopyCouponButton code={couponCode} />
          </div>
        )}
      </div>
    </section>
  );
}
