"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { channelField, channelGhostBtn, channelPrimaryBtn, money } from "../channel-ui";
import { Tip } from "../tip";
import { cn } from "@/lib/utils";

export type AddedRow = {
  key: string;
  bcProductId: number;
  title: string;
  shop: string;
  image?: string;
  sku: string;
  priceLabel: string;
  costLabel: string;
  adminUrl: string;
};

const removeBtn =
  "inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#B8282E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#9c2126] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8282E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";

export function AddedBoard({
  rows,
  page,
  pageCount,
  query,
  total,
}: {
  rows: AddedRow[];
  page: number;
  pageCount: number;
  query: string;
  total: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [ask, setAsk] = useState<AddedRow | null>(null);
  const [error, setError] = useState("");

  function href(nextPage: number) {
    const params = new URLSearchParams({ view: "added", page: String(nextPage) });
    if (query) params.set("q", query);
    return `/catalog?${params.toString()}`;
  }

  async function remove(row: AddedRow) {
    setAsk(null);
    setPending(row.key);
    setError("");
    try {
      const params = new URLSearchParams({ bcProductId: String(row.bcProductId), shop: row.shop });
      const res = await fetch(`/api/portal/shopify-channel/listings?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e7e1de] bg-white p-3 shadow-sm" action="/catalog">
        <input type="hidden" name="view" value="added" />
        <input name="q" defaultValue={query} placeholder="Search by name, your SKU, or store" className={cn(channelField, "min-w-[220px] flex-1")} aria-label="Search products on your store" />
        <button className={channelPrimaryBtn} type="submit">Search</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[#e7e1de] bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]">
        <div className="flex items-center justify-between border-b border-[#f0ebe8] px-4 py-3">
          <p className="text-sm font-medium text-[#1a1a1a]">
            {total} on your store
            <Tip text="These are products you already added. Your SKU and your price are the ones you set. Your cost is what we charge your card when a customer pays." />
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#2d2d2d] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-3 py-3">Store</th>
                <th className="px-3 py-3">Your SKU</th>
                <th className="px-3 py-3">Your price</th>
                <th className="px-3 py-3">Your cost</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-[#f0ebe8]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f6f3f1]">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.image} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-medium text-[#8a8481]">No photo</span>
                        )}
                      </div>
                      <p className="line-clamp-2 font-medium text-[#1a1a1a]">{row.title}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#3f3a38]">{row.shop.replace(".myshopify.com", "")}</td>
                  <td className="px-3 py-3 text-[#3f3a38]">{row.sku}</td>
                  <td className="px-3 py-3 tabular-nums">{row.priceLabel}</td>
                  <td className="px-3 py-3 tabular-nums">{row.costLabel}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <a className={channelGhostBtn} href={row.adminUrl} target="_blank" rel="noreferrer">Open in Shopify</a>
                      <button type="button" disabled={pending === row.key} onClick={() => setAsk(row)} className={removeBtn}>
                        {pending === row.key ? "Removing" : "Remove"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="font-medium text-[#1a1a1a]">{query ? "No added products match this search." : "Nothing is on your store yet."}</p>
                    <p className="mt-1 text-sm text-[#5c5654]">{query ? "Try another word." : "Browse the catalog and add a product."}</p>
                    {!query && (
                      <a className={cn(channelPrimaryBtn, "mt-4")} href="/catalog">Browse the catalog</a>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-[#f0ebe8] px-4 py-3 text-sm">
            <span className="text-[#5c5654]">Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              {page > 1 && <a className={channelGhostBtn} href={href(page - 1)}>Previous</a>}
              {page < pageCount && <a className={channelGhostBtn} href={href(page + 1)}>Next</a>}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-[#B8282E]">{error}</p>}

      <Dialog open={ask !== null} onOpenChange={(open) => { if (!open) setAsk(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this product?</DialogTitle>
            <DialogDescription>
              {ask ? `Remove “${ask.title}” from ${ask.shop}. The listing is deleted. Orders already placed stay as they are.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={channelGhostBtn} onClick={() => setAsk(null)}>Keep it</button>
            <button type="button" className={removeBtn} onClick={() => { if (ask) void remove(ask); }}>Remove</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function priceLabel(prices: number[]): string {
  if (prices.length === 0) return "—";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? money(low) : `${money(low)}–${money(high)}`;
}
