"use client";

import Link from "next/link";
import { channelPrimaryBtn } from "./channel-ui";

export function ShopifyMaintenanceModal() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopify-maintenance-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Shopify</p>
        <h2 id="shopify-maintenance-title" className="mt-2 font-display text-2xl font-semibold">
          Under maintenance
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#5c5654]">
          Connecting a Shopify store is under maintenance. We are fixing it. You do not need to try again right now.
        </p>
        <Link href="/dashboard" className={`${channelPrimaryBtn} mt-5 w-full`} autoFocus>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
