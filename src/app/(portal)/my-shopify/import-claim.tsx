"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { channelGhostBtn, channelPrimaryBtn } from "../channel-ui";

type Offer = { title: string; sku: string; price: number };
type View = {
  offers: Offer[];
  leftCount: number;
  skippedDuplicate: number;
  skippedAlready: number;
  partialProducts: number;
  checkedAll: boolean;
};

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ImportClaim({ connectionId, fresh }: { connectionId: string; fresh: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [pending, setPending] = useState<"yes" | "no" | "reopen" | null>(null);
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [taken, setTaken] = useState(0);

  async function load(next: { fresh?: boolean; reopen?: boolean }) {
    setPhase("loading");
    try {
      const res = await fetch("/api/portal/shopify-channel/import-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, fresh: next.fresh, reopen: next.reopen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not check this store");
      setView(data as View);
      setAnswer(null);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }

  useEffect(() => {
    load({ fresh });
    // Check once when this store card opens, and again right after a new connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, fresh]);

  async function decide(decision: "yes" | "no") {
    setPending(decision);
    try {
      const res = await fetch("/api/portal/shopify-channel/import-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save that answer");
      setTaken(Number(data.count) || 0);
      setAnswer(decision);
      setView((current) => (current ? { ...current, offers: [] } : current));
      router.refresh();
    } catch {
      setPhase("error");
    } finally {
      setPending(null);
    }
  }

  if (phase === "loading") {
    if (!fresh && !view) return null;
    return <p className="mt-4 text-sm leading-6 text-[#5c5654]">Looking through this store for products with our SKU…</p>;
  }
  if (phase === "error") {
    return (
      <p className="mt-4 text-sm leading-6 text-[#9c2126]">
        We could not look through this store just now. Refresh the page to try again.
      </p>
    );
  }
  if (!view) return null;

  if (answer === "yes") {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-950">
        <p className="font-semibold">We will take care of {countLabel(taken, "this product", "these products")}.</p>
        <p className="mt-1">Your prices stay as they are. We update how many are in stock from our warehouse. When a customer buys one, we charge your card and ship it.</p>
      </div>
    );
  }
  if (answer === "no") {
    return (
      <div className="mt-4 rounded-2xl border border-[#e7e1de] bg-[#faf7f6] px-4 py-4 text-sm leading-6 text-[#3f3a38]">
        <p className="font-semibold">Okay. Those products stay yours.</p>
        <p className="mt-1">We will not ship orders for them, and we will not change the quantity.</p>
        <button className={channelGhostBtn + " mt-3"} type="button" disabled={pending !== null} onClick={() => load({ reopen: true })}>
          I changed my mind
        </button>
      </div>
    );
  }

  if (view.offers.length === 0) {
    if (view.leftCount === 0) return null;
    return (
      <div className="mt-4 rounded-2xl border border-[#e7e1de] bg-[#faf7f6] px-4 py-4 text-sm leading-6 text-[#3f3a38]">
        <p>You asked us to leave {countLabel(view.leftCount, "imported product", "imported products")} alone.</p>
        <button className={channelGhostBtn + " mt-3"} type="button" disabled={pending !== null} onClick={() => { setPending("reopen"); load({ reopen: true }).finally(() => setPending(null)); }}>
          {pending === "reopen" ? "Looking…" : "I changed my mind"}
        </button>
      </div>
    );
  }

  const productLabel = countLabel(view.offers.length, "product", "products");
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="import-claim-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-sm leading-6 text-[#1a1a1a] shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Already on this store</p>
      <h3 id="import-claim-title" className="mt-1 font-display text-xl font-semibold">We found {productLabel} with our SKU</h3>
      <p className="mt-2 text-[#3f3a38]">
        These usually come from a spreadsheet import. The SKU on them is ours. Do you want us to take care of them?
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f6f3f1] px-3 py-3">
          <p className="font-semibold">If you say yes</p>
          <p className="mt-1 text-[#3f3a38]">When a customer buys one, we charge your card and ship it to them.</p>
          <p className="mt-1 text-[#3f3a38]">We update how many are in stock. The price you set stays the same.</p>
        </div>
        <div className="rounded-xl bg-[#f6f3f1] px-3 py-3">
          <p className="font-semibold">If you say no</p>
          <p className="mt-1 text-[#3f3a38]">We leave them alone. You handle those sales yourself.</p>
          <p className="mt-1 text-[#3f3a38]">Adding that same product from the catalog later puts a second copy on your store.</p>
        </div>
      </div>
      <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[#efeae7] bg-[#faf7f6] px-3 py-3">
        {view.offers.map((offer) => (
          <li key={`${offer.sku}-${offer.title}`} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#f3eeeb] pb-2 last:border-0 last:pb-0">
            <span>
              <span className="font-medium">{offer.title}</span>
              <span className="mt-0.5 block text-xs text-[#5c5654]">SKU {offer.sku}</span>
            </span>
            <span className="text-xs text-[#5c5654]">Your price ${offer.price.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      {view.partialProducts > 0 && (
        <p className="mt-3 text-[#5c5654]">
          {view.partialProducts === 1 ? "One product has" : `${view.partialProducts} products have`} other options that do not use our SKU. We only take care of the options that do.
        </p>
      )}
      {view.skippedDuplicate > 0 && (
        <p className="mt-3 text-[#5c5654]">
          We skipped {countLabel(view.skippedDuplicate, "SKU", "SKUs")} because the same SKU is on more than one product. Each SKU needs to be on one product only.
        </p>
      )}
      {view.skippedAlready > 0 && (
        <p className="mt-3 text-[#5c5654]">
          {countLabel(view.skippedAlready, "product is", "products are")} already taken care of by this connection.
        </p>
      )}
      {!view.checkedAll && (
        <p className="mt-3 text-[#5c5654]">This store has a lot of products. We checked the first 5,000.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={channelPrimaryBtn} type="button" disabled={pending !== null} onClick={() => decide("yes")}>
          {pending === "yes" ? "Saving…" : "Yes, take care of them"}
        </button>
        <button className={channelGhostBtn} type="button" disabled={pending !== null} onClick={() => decide("no")}>
          {pending === "no" ? "Saving…" : "No, leave them alone"}
        </button>
      </div>
      </div>
    </div>
  );
}
