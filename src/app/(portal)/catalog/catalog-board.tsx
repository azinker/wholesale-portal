"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { channelField, channelGhostBtn, channelPrimaryBtn, money } from "../channel-ui";
import { Tip } from "../tip";
import { cn } from "@/lib/utils";
import { DraftEditor, draftFromProduct, draftSummary, pushFromDraft, type CatalogVariant, type ListingDraft } from "./add-draft";

type ProductCard = {
  id: number;
  name: string;
  image?: string;
  stock: number;
  retail: number;
  cost: number;
  variants?: CatalogVariant[];
};

type StoreChoice = { id: string; shopDomain: string };

type VariantReceipt = {
  label: string;
  retail: number;
  cost: number;
  stock: number;
  imageUrl: string | null;
};

type Receipt = {
  status: "added" | "skipped" | "failed";
  title: string;
  imageUrl: string | null;
  shopDomain: string;
  storeUrl: string | null;
  adminUrl: string | null;
  retail: number;
  cost: number;
  margin: number;
  stock: number;
  variants: VariantReceipt[];
  message: string;
};

type ProgressRow = {
  id: number;
  name: string;
  state: "waiting" | "adding" | "done" | "failed";
  receipts: Receipt[];
  error?: string;
};

const addedBtn =
  "inline-flex cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

const removeBtn =
  "inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#B8282E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#9c2126] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8282E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";

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
  dir,
  inStock,
  categories,
  loadFailed,
  listedIds,
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
  dir: "asc" | "desc";
  inStock: boolean;
  categories: Array<{ id: number; name: string; count: number }>;
  loadFailed: boolean;
  listedIds: number[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>(stores.length === 1 ? [stores[0].id] : []);
  const [pending, setPending] = useState(false);
  const [knownListed, setKnownListed] = useState<number[]>(listedIds);
  useEffect(() => {
    setKnownListed(listedIds);
  }, [listedIds]);
  const [rows, setRows] = useState<ProgressRow[] | null>(null);
  const [jobLabel, setJobLabel] = useState<string | null>(null);
  const [jobCounts, setJobCounts] = useState<{ added: number; skipped: number; failed: number; status: string } | null>(null);
  const [view, setView] = useState<Receipt[] | null>(null);
  const [viewProduct, setViewProduct] = useState<ProductCard | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTitle, setViewTitle] = useState("");
  const [task, setTask] = useState<"add" | "remove">("add");
  const [drafts, setDrafts] = useState<ListingDraft[] | null>(null);

  const dialogOpen = rows !== null || jobLabel !== null || view !== null || viewLoading;
  const running = pending;

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

  function chosenStores(): StoreChoice[] {
    if (stores.length === 1) return stores;
    return stores.filter((store) => storeIds.includes(store.id));
  }

  function closeDialog() {
    if (pending) return;
    setRows(null);
    setJobLabel(null);
    setJobCounts(null);
    setView(null);
    setViewProduct(null);
    setViewLoading(false);
  }

  async function addOne(productId: number, connectionId: string, push: ReturnType<typeof pushFromDraft>): Promise<Receipt> {
    const res = await fetch("/api/portal/shopify-channel/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "selection", bcProductIds: [productId], connectionIds: [connectionId], push }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add");
    return data.receipt as Receipt;
  }

  function openDrafts(ids: number[]) {
    const targets = chosenStores();
    if (!canAdd || !ready) return;
    if (targets.length === 0) {
      setRows([{ id: 0, name: "Choose a store", state: "failed", receipts: [], error: "Choose which store to add to, above the list." }]);
      return;
    }
    const queue = ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is ProductCard => Boolean(product));
    if (queue.length === 0) return;
    setView(null);
    setRows(null);
    setDrafts(queue.map((product) => draftFromProduct(product, queue.length === 1)));
  }

  async function publishDrafts() {
    const queue = drafts;
    const targets = chosenStores();
    if (!queue || queue.length === 0 || !canAdd || !ready) return;
    if (targets.length === 0) return;
    setDrafts(null);
    setPending(true);
    setView(null);
    setViewProduct(null);
    setJobLabel(null);
    setTask("add");
    setRows(queue.map((draft) => ({ id: draft.productId, name: draft.name, state: "waiting", receipts: [] })));
    const finished: number[] = [];
    for (const draft of queue) {
      setRows((current) => current?.map((row) => (row.id === draft.productId ? { ...row, state: "adding" } : row)) || null);
      const receipts: Receipt[] = [];
      let error = "";
      for (const store of targets) {
        try {
          receipts.push(await addOne(draft.productId, store.id, pushFromDraft(draft)));
        } catch (caught) {
          error = caught instanceof Error ? caught.message : "Could not add";
        }
      }
      const ok = receipts.some((receipt) => receipt.status === "added" || receipt.status === "skipped");
      if (ok) finished.push(draft.productId);
      setRows((current) =>
        current?.map((row) =>
          row.id === draft.productId ? { ...row, state: error && !ok ? "failed" : "done", receipts, error: error || undefined } : row
        ) || null
      );
    }
    if (finished.length) setKnownListed((current) => [...new Set([...current, ...finished])]);
    setSelected([]);
    setPending(false);
    router.refresh();
  }

  async function publishScope(scope: "category" | "catalog") {
    const targets = chosenStores();
    if (!canAdd || !ready) return;
    if (targets.length === 0) {
      setRows([{ id: 0, name: "Choose a store", state: "failed", receipts: [], error: "Choose which store to add to, above the list." }]);
      return;
    }
    const count = scope === "catalog" ? catalogCount : matchCount;
    const label = scope === "catalog" ? "the entire catalog" : "everything in this search";
    if (!window.confirm(`Add ${count} products from ${label} at the retail price, with no SKU? To set a price or SKU, select products and use Add selected.`)) return;
    setPending(true);
    setTask("add");
    setRows(null);
    setView(null);
    setJobCounts({ added: 0, skipped: 0, failed: 0, status: "RUNNING" });
    setJobLabel(scope === "catalog" ? "Adding the catalog" : "Adding this search");
    try {
      const res = await fetch("/api/portal/shopify-channel/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          connectionIds: targets.map((store) => store.id),
          keyword: scope === "catalog" ? undefined : keyword,
          categoryId: scope === "catalog" || !categoryId ? undefined : Number(categoryId),
          push: { priceMode: "retail" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add");
      const jobIds = (data.jobIds || []) as string[];
      const snapshots = new Map<string, { added: number; skipped: number; failed: number; status: string }>();
      const totals = () => {
        let added = 0;
        let skipped = 0;
        let failed = 0;
        let stillRunning = false;
        for (const snap of snapshots.values()) {
          added += snap.added;
          skipped += snap.skipped;
          failed += snap.failed;
          if (snap.status === "QUEUED" || snap.status === "RUNNING") stillRunning = true;
        }
        return { added, skipped, failed, status: stillRunning ? "RUNNING" : "COMPLETED" };
      };
      for (const jobId of jobIds) {
        let status = "RUNNING";
        while (status === "QUEUED" || status === "RUNNING") {
          const tick = await fetch(`/api/portal/shopify-channel/listings/jobs/${jobId}`, { method: "POST" });
          const body = await tick.json();
          if (!tick.ok) throw new Error(body.error || "The add stopped");
          status = body.status || "FAILED";
          snapshots.set(jobId, {
            added: body.addedCount || 0,
            skipped: body.skippedCount || 0,
            failed: body.failedCount || 0,
            status,
          });
          setJobCounts(totals());
        }
      }
      setJobCounts(totals());
    } catch (error) {
      setRows([{ id: 0, name: label, state: "failed", receipts: [], error: error instanceof Error ? error.message : "Could not add" }]);
      setJobLabel(null);
    } finally {
      setPending(false);
      router.refresh();
    }
  }

  async function openListing(product: ProductCard) {
    setRows(null);
    setJobLabel(null);
    setViewTitle(product.name);
    setViewProduct(product);
    setViewLoading(true);
    setView(null);
    try {
      const res = await fetch(`/api/portal/shopify-channel/listings?bcProductId=${product.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open this listing");
      setView((data.receipts || []) as Receipt[]);
    } catch (error) {
      setRows([
        {
          id: product.id,
          name: product.name,
          state: "failed",
          receipts: [],
          error: error instanceof Error ? error.message : "Could not open this listing",
        },
      ]);
      setViewLoading(false);
    } finally {
      setViewLoading(false);
    }
  }

  async function removeListed(product: ProductCard, shop?: string) {
    const where = shop ? ` from ${shop}` : " from your Shopify store";
    if (!window.confirm(`Remove “${product.name}”${where}? This deletes that listing. Orders already placed are not changed.`)) return;
    setPending(true);
    setView(null);
    setViewProduct(product);
    setJobLabel(null);
    setTask("remove");
    setRows([{ id: product.id, name: product.name, state: "adding", receipts: [] }]);
    try {
      const params = new URLSearchParams({ bcProductId: String(product.id) });
      if (shop) params.set("shop", shop);
      const res = await fetch(`/api/portal/shopify-channel/listings?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove");
      if (!shop || stores.length <= 1) {
        setKnownListed((current) => current.filter((id) => id !== product.id));
      }
      setRows([{ id: product.id, name: product.name, state: "done", receipts: [], error: "Removed from your Shopify store." }]);
    } catch (error) {
      setRows([
        {
          id: product.id,
          name: product.name,
          state: "failed",
          receipts: [],
          error: error instanceof Error ? error.message : "Could not remove",
        },
      ]);
    } finally {
      setPending(false);
      router.refresh();
    }
  }

  const blocked = !ready || !canAdd;
  const reason = !canAdd ? "Viewers cannot add products." : "Finish setup on My Shopify before Add turns on.";

  function pageHref(nextPage: number) {
    const params = new URLSearchParams({
      q: keyword,
      category: categoryId,
      sort,
      dir,
      stock: inStock ? "1" : "",
      page: String(nextPage),
    });
    return `/catalog?${params.toString()}`;
  }

  function sortHref(key: string) {
    const nextDir = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "name" || key === "price" || key === "cost" ? "asc" : "desc";
    const params = new URLSearchParams({
      q: keyword,
      category: categoryId,
      sort: key,
      dir: nextDir,
      stock: inStock ? "1" : "",
      page: "1",
    });
    return `/catalog?${params.toString()}`;
  }

  const detailReceipts = view && view.length > 0 ? view : rows?.length === 1 && rows[0].state === "done" ? rows[0].receipts : null;

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
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-[#3f3a38]">
          <input type="checkbox" name="stock" value="1" defaultChecked={inStock} className="h-4 w-4 accent-[#B8282E]" />
          In stock
          <Tip text="Show only products we can ship today." />
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

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2d2d2d] bg-[#2d2d2d] px-4 py-3 text-white shadow-sm">
          <p className="text-sm font-medium">{selected.length} selected</p>
          <button type="button" disabled={blocked || pending} onClick={() => openDrafts(selected)} className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#f6f3f1] disabled:cursor-not-allowed disabled:opacity-45">
            Add selected to Shopify
          </button>
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
                <SortHead label="Product" tip="The product name. Click to sort A to Z or Z to A. After you add it, the name on your Shopify store stays as it was." active={sort === "name"} dir={dir} href={sortHref("name")} />
                <SortHead label="Stock" tip="How many we can ship today. Your Shopify quantity follows this number. We do not sell more than we have." active={sort === "stock"} dir={dir} href={sortHref("stock")} />
                <SortHead label="Lists at" tip="The price on theperfectpart.net. This is the starting price on your Shopify store. You can set a different price before you add it, and you can change the price any time directly in Shopify. We never change that price for you." active={sort === "price"} dir={dir} href={sortHref("price")} />
                <SortHead label="Your cost" tip="What we charge your card when your customer pays. US shipping is $0. Raising or lowering your Shopify price does not change this charge." active={sort === "cost"} dir={dir} href={sortHref("cost")} />
                <SortHead label="Margin" tip="Lists at minus your cost, before you change the Shopify price. A higher Shopify price increases what you keep. We still charge your cost." active={sort === "margin"} dir={dir} href={sortHref("margin")} />
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const margin = product.retail - product.cost;
                const checked = selected.includes(product.id);
                const listed = knownListed.includes(product.id);
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
                        {listed ? (
                          <button type="button" onClick={() => openListing(product)} className="line-clamp-2 cursor-pointer text-left font-medium text-[#1a1a1a] underline-offset-2 hover:underline">
                            {product.name}
                          </button>
                        ) : (
                          <p className="line-clamp-2 font-medium text-[#1a1a1a]">{product.name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[#3f3a38]">{product.stock}</td>
                    <td className="px-3 py-3 tabular-nums">{money(product.retail)}</td>
                    <td className="px-3 py-3 tabular-nums">{money(product.cost)}</td>
                    <td className={cn("px-3 py-3 tabular-nums font-semibold", margin < 0 ? "text-[#B8282E]" : "text-emerald-700")}>{money(margin)}</td>
                    <td className="px-4 py-3 text-right">
                      {listed ? (
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openListing(product)} className={addedBtn}>Added</button>
                          <button type="button" disabled={pending} onClick={() => removeListed(product)} className={removeBtn}>Remove</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={blocked || pending}
                          title={blocked ? reason : "Adds this product to your Shopify store at the retail price."}
                          onClick={() => openDrafts([product.id])}
                          className={channelPrimaryBtn}
                        >
                          Add
                        </button>
                      )}
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
          <p className="max-w-md text-sm text-[#5c5654]">{blocked ? reason : selected.length ? `${selected.length} selected.` : "Check products, then add them together."}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={blocked || pending || selected.length === 0} onClick={() => openDrafts(selected)} className={channelPrimaryBtn}>
              Add selected ({selected.length})
            </button>
            <button type="button" disabled={blocked || pending || matchCount === 0} onClick={() => publishScope("category")} className={channelGhostBtn}>
              Add this search ({matchCount})
            </button>
            <button type="button" disabled={blocked || pending || catalogCount === 0} onClick={() => publishScope("catalog")} className={channelGhostBtn}>
              Add entire catalog ({catalogCount})
            </button>
          </div>
        </div>
      </div>

      <Dialog open={drafts !== null} onOpenChange={(open) => { if (!open) setDrafts(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{drafts && drafts.length === 1 ? "Add to your Shopify store" : `Add ${drafts?.length || 0} products`}</DialogTitle>
            <DialogDescription>
              List price starts at the retail price. Set your price and SKU, then add. We charge your cost when the customer pays.
            </DialogDescription>
          </DialogHeader>
          {drafts && drafts.length === 1 && (
            <div className="space-y-4">
              <p className="font-medium text-[#1a1a1a]">{drafts[0].name}</p>
              <DraftEditor draft={drafts[0]} onChange={(next) => setDrafts([next])} />
              <button type="button" onClick={() => publishDrafts()} className={channelPrimaryBtn}>Add to Shopify</button>
            </div>
          )}
          {drafts && drafts.length > 1 && (
            <div className="space-y-3">
              {drafts.map((draft, index) => (
                <div key={draft.productId} className="rounded-xl border border-[#e7e1de]">
                  <button
                    type="button"
                    onClick={() => setDrafts(drafts.map((row, rowIndex) => rowIndex === index ? { ...row, open: !row.open } : row))}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block font-medium text-[#1a1a1a]">{draft.name}</span>
                      <span className="text-sm text-[#5c5654]">{draftSummary(draft)}</span>
                    </span>
                    <span className={cn("shrink-0 text-xs font-semibold", draft.saved && !draft.open ? "text-emerald-700" : "text-[#5c5654]")}>
                      {draft.open ? "Close" : draft.saved ? "Saved" : "Edit"}
                    </span>
                  </button>
                  {draft.open && (
                    <div className="space-y-3 border-t border-[#f0ebe8] px-4 py-3">
                      <DraftEditor
                        draft={draft}
                        onChange={(next) => setDrafts(drafts.map((row, rowIndex) => rowIndex === index ? next : row))}
                      />
                      <button
                        type="button"
                        onClick={() => setDrafts(drafts.map((row, rowIndex) => rowIndex === index ? { ...row, open: false, saved: true } : row))}
                        className={channelPrimaryBtn}
                      >
                        Save this item
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                disabled={drafts.some((draft) => draft.open || !draft.saved)}
                onClick={() => publishDrafts()}
                className={channelPrimaryBtn}
              >
                {drafts.some((draft) => draft.open || !draft.saved) ? "Save each open item first" : `Add all ${drafts.length} to Shopify`}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" onPointerDownOutside={(event) => { if (running) event.preventDefault(); }} onEscapeKeyDown={(event) => { if (running) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>
              {viewLoading ? "Opening the listing" : view ? viewTitle || "On your Shopify store" : task === "remove" ? (pending ? "Removing from your Shopify store" : "Removed from your Shopify store") : jobLabel ? jobLabel : rows?.some((row) => row.state === "adding" || row.state === "waiting") ? "Adding to your Shopify store" : "Added to your Shopify store"}
            </DialogTitle>
            <DialogDescription>
              {viewLoading
                ? "Loading the price, stock, and the link on your store."
                : view
                  ? "This is the listing on your Shopify store."
                  : running
                    ? "Stay on this page. Each product is added before the next one starts."
                    : "The price is the retail price. Change it later in Shopify if you want a different sale price."}
            </DialogDescription>
          </DialogHeader>

          {viewLoading && (
            <div className="flex items-center gap-3 py-6 text-sm text-[#3f3a38]">
              <Loader2 className="h-5 w-5 animate-spin text-[#B8282E]" />
              Opening this listing…
            </div>
          )}

          {jobLabel && jobCounts && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-[#3f3a38]">
                {jobCounts.status === "RUNNING" || jobCounts.status === "QUEUED" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#B8282E]" />
                ) : null}
                <p>{jobCounts.status === "COMPLETED" || jobCounts.status === "FAILED" ? "Finished." : "Working through the products."}</p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-emerald-50 px-3 py-3"><dt className="text-[#5c5654]">Added</dt><dd className="text-lg font-semibold text-emerald-800">{jobCounts.added}</dd></div>
                <div className="rounded-xl bg-[#f6f3f1] px-3 py-3"><dt className="text-[#5c5654]">Already there</dt><dd className="text-lg font-semibold">{jobCounts.skipped}</dd></div>
                <div className="rounded-xl bg-red-50 px-3 py-3"><dt className="text-[#5c5654]">Not added</dt><dd className="text-lg font-semibold text-[#B8282E]">{jobCounts.failed}</dd></div>
              </dl>
            </div>
          )}

          {rows && !view && (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id} className="rounded-xl border border-[#e7e1de] p-3">
                  <div className="flex items-start gap-3">
                    {row.state === "adding" || row.state === "waiting" ? (
                      <Loader2 className={cn("mt-0.5 h-4 w-4 shrink-0 text-[#B8282E]", row.state === "adding" && "animate-spin")} />
                    ) : (
                      <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", row.state === "failed" ? "bg-[#B8282E]" : "bg-emerald-600")} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#1a1a1a]">{row.name}</p>
                      <p className="text-sm text-[#5c5654]">
                        {row.state === "waiting" && "Waiting"}
                        {row.state === "adding" && (task === "remove" ? "Removing now" : "Adding now")}
                        {row.state === "failed" && (row.error || "Could not add")}
                        {row.state === "done" && (row.receipts[0]?.message || row.error || "Done")}
                      </p>
                    </div>
                  </div>
                  {row.state === "done" && row.receipts.map((receipt, index) => (
                    <ReceiptBody key={`${receipt.shopDomain}-${index}`} receipt={receipt} />
                  ))}
                </li>
              ))}
            </ul>
          )}

          {detailReceipts && view && (
            <div className="space-y-4">
              {detailReceipts.map((receipt, index) => (
                <ReceiptBody key={`${receipt.shopDomain}-${index}`} receipt={receipt} onRemove={viewProduct ? () => removeListed(viewProduct, receipt.shopDomain) : undefined} />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortHead({
  label,
  tip,
  active,
  dir,
  href,
}: {
  label: string;
  tip: string;
  active: boolean;
  dir: "asc" | "desc";
  href: string;
}) {
  return (
    <th className="px-3 py-3">
      <div className="flex items-center gap-1.5">
        <Link href={href} className="inline-flex items-center gap-1 hover:text-white/80">
          {label}
          <span aria-hidden="true">{active ? (dir === "asc" ? "↑" : "↓") : ""}</span>
        </Link>
        <Tip text={tip} tone="dark" />
      </div>
    </th>
  );
}

function ReceiptBody({ receipt, onRemove }: { receipt: Receipt; onRemove?: () => void }) {
  return (
    <div className="mt-3 space-y-3 border-t border-[#f0ebe8] pt-3">
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f6f3f1]">
          {receipt.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-[#8a8481]">No photo</span>
          )}
        </div>
        <div className="min-w-0 text-sm">
          <p className="font-medium text-[#1a1a1a]">{receipt.shopDomain}</p>
          <p className="text-[#5c5654]">{receipt.status === "failed" ? receipt.message : receipt.status === "skipped" ? "Already on this store" : "Added just now"}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-[#5c5654]">Lists at</dt><dd className="font-semibold tabular-nums">{money(receipt.retail)}</dd></div>
        <div><dt className="text-[#5c5654]">Your cost</dt><dd className="font-semibold tabular-nums">{money(receipt.cost)}</dd></div>
        <div><dt className="text-[#5c5654]">Margin</dt><dd className={cn("font-semibold tabular-nums", receipt.margin < 0 ? "text-[#B8282E]" : "text-emerald-700")}>{money(receipt.margin)}</dd></div>
        <div><dt className="text-[#5c5654]">Stock sent</dt><dd className="font-semibold tabular-nums">{receipt.stock}</dd></div>
      </dl>
      {receipt.variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c5654]">Variants</p>
          <ul className="space-y-2">
            {receipt.variants.map((variant) => (
              <li key={variant.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#1a1a1a]">{variant.label}{variant.imageUrl ? " · own photo" : ""}</span>
                <span className="shrink-0 tabular-nums text-[#3f3a38]">{money(variant.retail)} · {variant.stock} in stock</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {receipt.storeUrl && (
          <a className={channelPrimaryBtn} href={receipt.storeUrl} target="_blank" rel="noreferrer">View on your store</a>
        )}
        {receipt.adminUrl && (
          <a className={channelGhostBtn} href={receipt.adminUrl} target="_blank" rel="noreferrer">Edit price in Shopify</a>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className={removeBtn}>Remove</button>
        )}
      </div>
    </div>
  );
}
