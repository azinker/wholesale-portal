import { Ticket, DollarSign } from "lucide-react";
import { CopyCouponButton } from "./copy-coupon-button";

export function WholesaleWallet({
  email,
  code,
  discountLabel,
  storeCredit,
}: {
  email: string;
  code: string | null;
  discountLabel: string | null;
  storeCredit: number;
}) {
  return (
    <section className={storeCredit > 0 ? "grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]" : "grid gap-3"}>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-5 shadow-[0_10px_30px_rgba(16,185,129,0.06)]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Ticket className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-emerald-950">Your wholesale coupon</p>
          {discountLabel && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {discountLabel}
            </span>
          )}
        </div>
        {code ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="rounded-xl border border-emerald-300 bg-white px-4 py-3 font-mono text-2xl font-bold tracking-[0.08em] text-emerald-700 select-all">
                {code}
              </p>
              <CopyCouponButton code={code} />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-950">
              On theperfectpart.net, sign in as <strong>{email}</strong>, then enter this code at checkout. That applies your wholesale price and no tax. Shipping is free in the US. A shipment outside the US is $18.99, and the product discount still applies.
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-900/70">
              Use the same email as this dashboard. A different signed-in store window will not take the code.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-emerald-950">
            Your coupon shows here once this account qualifies. Sign in on theperfectpart.net as <strong>{email}</strong> when you shop.
          </p>
        )}
      </div>
      {storeCredit > 0 && <div className="rounded-2xl border border-[#f0d2d4] bg-[#fff8f8] px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <DollarSign className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold">Store credit</p>
        </div>
        <p className="mt-4 font-mono text-3xl font-bold text-primary">${storeCredit.toFixed(2)}</p>
        <p className="mt-2 text-sm leading-6 text-[#3f3a38]">
          Store credit is applied automatically to new orders. We use it before your card, so the card is not charged for the part this balance covers.
        </p>
        <p className="mt-1 text-xs leading-5 text-[#5c5654]">
          It also applies at checkout on theperfectpart.net. Orders that already happened stay as they are.
        </p>
      </div>}
    </section>
  );
}
