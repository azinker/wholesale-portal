"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { channelField, channelGhostBtn, channelPrimaryBtn, money } from "../channel-ui";
import { cn } from "@/lib/utils";

type ProductCard = {
  id: number;
  name: string;
  image?: string;
  stock: number;
  retail: number;
  cost: number;
};

type StoreChoice = { id: string; shopDomain: string };

export function CatalogBoard({
  products,
  stores,
  ready,
  canAdd,
  keyword,
  categoryId,
  matchCount,
  catalogCount,
  page,
  sort,
  inStock,
  categories,
  loadFailed,
}: {
  products: ProductCard[];
  stores: StoreChoice[];
  ready: boolean;
  canAdd: boolean;
  keyword: string;
  categoryId: string;
  matchCount: number;
  catalogCount: number;
  page: number;
  sort: string;
  inStock: boolean;
  categories: Array<{ id: number; name: string; count: number }>;
  loadFailed: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>(stores.length === 1 ? [stores[0].id] : []);
  const [pending, setPending] = useState(false);

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]));
  }

  const pageIds = products.map((product) => product.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function togglePage() {
    setSelected((current) =>
      allOnPage ? current.filter((id) => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])]
    );
  }

  async function publish(scope: "selection" | "category" | "catalog", ids: number[] = []) {
    if (!canAdd || !ready) return;
    if (stores.length > 1 && storeIds.length === 0) {
      toast.error("Choose which stores to add to");
      return;
    }
    if (scope === "category" || scope === "catalog") {
      const count = scope === "catalog" ? catalogCount : matchCount;
      const label = scope === "catalog" ? "the entire catalog" : "everything in this search";
      if (!window.confirm(`Add ${count} products from ${label}? Already listed products are skipped. One email arrives when it finishes.`)) {
        return;
      }
    }
    setPending(true);
    try {
      const res = await fetch("/api/portal/shopify-channel/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          bcProductIds: ids,
          connectionIds: storeIds,
          keyword: scope === "catalog" ? undefined : keyword,
          categoryId: scope === "catalog" || !categoryId ? undefined : Number(categoryId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add");
      toast.success("Add started. We will email you when it finishes.");
      setSelected([]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add");
    } finally {
      setPending(false);
    }
  }

  const blocked = !ready || !canAdd;
  const reason = !canAdd
    ? "Viewers cannot add products."
    : "Finish setup on My Shopify before Add turns on.";

  function pageHref(nextPage: number) {
    const params = new URLSearchParams({
      q: keyword,
      category: categoryId,
      sort,
      stock: inStock ? "1" : "",
      page: String(nextPage),
    });
    return `/catalog?${params.toString()}`;
  }

  return (
    <div className="space-y-4 pb-28">
      <form className="channel-in flex flex-wrap items-center gap-2 rounded-2xl border border-[#e7e1de] bg-white p-3 shadow-sm" action="/catalog" style={{ animationDelay: "80ms" }}>
        <input name="q" defaultValue={keyword} placeholder="Search by product name" className={cn(channelField, "min-w-[220px] flex-1")} aria-label="Search products" />
        <select name="category" defaultValue={categoryId} className={cn(channelField, "w-auto min-w-[240px]")} aria-label="Category">
          <option value="">All categories ({catalogCount})</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name} ({category.count})</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className={cn(channelField, "w-auto min-w-[150px]")} aria-label="Sort">
          <option value="total_sold">Best selling</option>
          <option value="name">Name</option>
          <option value="price">Price</option>
          <option value="date_modified">Newest</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-[#3f3a38]">
          <input type="checkbox" name="stock" value="1" defaultChecked={inStock} className="h-4 w-4 accent-[#B8282E]" />
          In stock
        </label>
        <button className={channelPrimaryBtn} type="submit">Search</button>
      </form>

      {stores.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[#5c5654]">Add to</span>
          {stores.map((store) => {
            const on = storeIds.includes(store.id);
            return (
              <button
                key={store.id}
                type="button"
                onClick={() =>
                  setStoreIds((current) =>
                    current.includes(store.id) ? current.filter((id) => id !== store.id) : [...current, store.id]
                  )
                }
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                  on ? "border-[#2d2d2d] bg-[#2d2d2d] text-white" : "border-[#e4ddd9] bg-white text-[#3f3a38] hover:border-[#2d2d2d]"
                )}
              >
                {store.shopDomain}
              </button>
            );
          })}
        </div>
      )}

      <div className="channel-in overflow-hidden rounded-2xl border border-[#e7e1de] bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]" style={{ animationDelay: "140ms" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[#2d2d2d] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select every product on this page" className="h-4 w-4 accent-[#B8282E]" />
                </th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3">Lists at</th>
                <th className="px-3 py-3">Your cost</th>
                <th className="px-3 py-3">Margin</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const margin = product.retail - product.cost;
                const checked = selected.includes(product.id);
                return (
                  <tr key={product.id} className={cn("border-t border-[#f0ebe8] transition-colors duration-200 hover:bg-[#faf7f6]", checked && "bg-[#fdf6f6]")}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={checked} onChange={() => toggle(product.id)} aria-label={`Select ${product.name}`} className="h-4 w-4 accent-[#B8282E]" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f6f3f1]">
                          {product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.image} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[10px] font-medium text-[#8a8481]">No photo</span>
                          )}
                        </div>
                        <p className="line-clamp-2 font-medium text-[#1a1a1a]">{product.name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[#3f3a38]">{product.stock}</td>
                    <td className="px-3 py-3 tabular-nums">{money(product.retail)}</td>
                    <td className="px-3 py-3 tabular-nums">{money(product.cost)}</td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-emerald-700">{money(margin)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={blocked || pending}
                        title={blocked ? reason : "Adds this product at the retail price. We email you when it finishes."}
                        onClick={() => publish("selection", [product.id])}
                        className={channelPrimaryBtn}
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <p className="font-medium text-[#1a1a1a]">
                      {loadFailed ? "The catalog cannot load yet." : "No products match this search."}
                    </p>
                    <p className="mt-1 text-sm text-[#5c5654]">
                      {loadFailed ? "The store connection does not have permission to read products." : "Clear the search or pick another category."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(page > 1 || products.length === 24) && (
          <div className="flex items-center justify-between border-t border-[#f0ebe8] px-4 py-3 text-sm">
            <span className="text-[#5c5654]">Page {page}</span>
            <div className="flex gap-2">
              {page > 1 && <a className={channelGhostBtn} href={pageHref(page - 1)}>Previous</a>}
              {products.length === 24 && <a className={channelGhostBtn} href={pageHref(page + 1)}>Next</a>}
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-4 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7e1de] bg-white/95 px-4 py-3 shadow-[0_12px_40px_rgba(45,45,45,0.12)] backdrop-blur">
          <p className="max-w-md text-sm text-[#5c5654]">{blocked ? reason : `${selected.length} selected on this page.`}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={blocked || pending || selected.length === 0} title="Adds the checked products. Already listed ones are skipped." onClick={() => publish("selection", selected)} className={channelPrimaryBtn}>
              Add selected ({selected.length})
            </button>
            <button type="button" disabled={blocked || pending || matchCount === 0} title="Example: search brake pads, then add every match. One email when it finishes." onClick={() => publish("category")} className={channelGhostBtn}>
              Add this search ({matchCount})
            </button>
            <button type="button" disabled={blocked || pending || catalogCount === 0} title="Adds every visible product. One email when the whole catalog finishes." onClick={() => publish("catalog")} className={channelGhostBtn}>
              Add entire catalog ({catalogCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
