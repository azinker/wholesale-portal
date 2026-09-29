import type { ReactNode } from "react";
import Link from "next/link";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { CopyCouponButton } from "./copy-coupon-button";

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f6f3f1] text-xs font-semibold text-[#1a1a1a]">
        {n}
      </span>
      <p className="text-sm leading-6 text-[#3f3a38]">{children}</p>
    </li>
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
    <section className="overflow-hidden rounded-2xl border border-[#e7e1de] bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]">
      <div className="border-b border-[#f0ebe8] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">How to start</p>
        <h2 className="font-display text-xl font-semibold">
          {channel.visible ? "Two ways to buy. Use one, or both." : "How to place an order"}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5654]">
          {channel.visible
            ? "Shop on our website with your discount code, sell the same products on your own Shopify store, or do both. Nothing extra to set up if you only want one of them."
            : "Shop on our website with your discount code. Sign in with the same email you use here, then enter the code at checkout."}
        </p>
      </div>

      <div className={channel.visible ? "grid lg:grid-cols-2" : ""}>
        <div className="space-y-4 px-5 py-5">
          <div>
            <h3 className="font-display text-lg font-semibold">Buy on our website</h3>
            <p className="mt-1 text-sm leading-6 text-[#5c5654]">
              You pick the products. We ship them to you. This is the original way, and it still works exactly the same.
            </p>
          </div>
          <ol className="space-y-3">
            <Step n={1}>
              Open{" "}
              <a href="https://theperfectpart.net" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
                theperfectpart.net
              </a>
              .
            </Step>
            <Step n={2}>
              Sign in with <strong className="text-[#1a1a1a]">{email}</strong>. That has to be the same email as this portal. If the store is signed in as anyone else, sign out first, then sign in with this one.
            </Step>
            <Step n={3}>Add what you want to the cart.</Step>
            <Step n={4}>
              {couponCode ? (
                <>
                  At checkout, enter your code{" "}
                  <span className="font-mono font-semibold text-[#1a1a1a]">{couponCode}</span>
                  . That is what applies your wholesale price, free US shipping, and no tax.
                </>
              ) : (
                <>
                  At checkout, enter the discount code from this dashboard. It applies your wholesale price, free US shipping, and no tax. Your code shows here once your account qualifies.
                </>
              )}
            </Step>
            <Step n={5}>Pay. We ship the order to you.</Step>
          </ol>
          {couponCode && (
            <div className="flex flex-wrap items-center gap-2">
              <CopyCouponButton code={couponCode} />
              <a
                href="https://theperfectpart.net/login.php"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Sign in on the store
              </a>
            </div>
          )}
          <p className="rounded-xl bg-[#f6f3f1] px-4 py-3 text-sm leading-6 text-[#3f3a38]">
            The usual mix-up: the store is open in one window, signed in with a different email, or not signed in at all. The code only works when that store login matches <strong>{email}</strong>. Sign out, sign back in with this email, then enter the code.
          </p>
        </div>

        {channel.visible && (
          <div className="space-y-4 border-t border-[#f0ebe8] px-5 py-5 lg:border-l lg:border-t-0">
            <div>
              <h3 className="font-display text-lg font-semibold">Sell on your Shopify store</h3>
              <p className="mt-1 text-sm leading-6 text-[#5c5654]">
                Your customer pays you on your store. We charge the card you save here, and we ship the order to them.
              </p>
            </div>
            <ol className="space-y-3">
              <Step n={1}>
                Open <Link href="/my-shopify" className="font-semibold text-primary underline underline-offset-2">My Shopify</Link>. Agree to the terms, save a card, and connect your store. You can connect up to 5.
              </Step>
              <Step n={2}>
                Open <Link href="/catalog" className="font-semibold text-primary underline underline-offset-2">Catalog</Link> and add the products you want to sell. You can set your price, and your own SKU, before they go on your store.
              </Step>
              <Step n={3}>Your customer orders and pays you on Shopify, the same as any other product you sell.</Step>
              <Step n={4}>We charge your card for your cost and ship it to them. Tracking goes back onto that Shopify order.</Step>
              <Step n={5}>You keep whatever is left after your cost. Your other Shopify products stay on Shopify. We only see the ones you added from the catalog.</Step>
            </ol>
            <p className="rounded-xl bg-[#f6f3f1] px-4 py-3 text-sm leading-6 text-[#3f3a38]">
              You can use both. The website code is for orders you place yourself. Shopify is for a customer buying on your store. One does not replace the other.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
