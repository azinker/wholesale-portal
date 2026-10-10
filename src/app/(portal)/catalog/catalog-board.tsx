"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { channelField, channelGhostBtn, channelPrimaryBtn, money } from "../channel-ui";
import { Tip } from "../tip";
import { cn } from "@/lib/utils";
import { applyDraftMode, DraftEditor, draftFromProduct, draftSummary, pushFromDraft, type CatalogVariant, type ListingDraft } from "./add-draft";
import { jobProgress, readTrackedJobs, setCatalogDialogOpen, subscribeJobs, trackCatalogJobs, type TrackedJob } from "./catalog-jobs";

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
  const [knownCards, setKnownCards] = useState<Record<number, ProductCard>>({});
  const [selectionReady, setSelectionReady] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [tracked, setTracked] = useState<TrackedJob[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>(stores.length === 1 ? [stores[0].id] : []);
  const [pending, setPending] = useState(false);
  const [knownListed, setKnownListed] = useState<number[]>(listedIds);
  useEffect(() => {
    setKnownListed(listedIds);
  }, [listedIds]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tpp-catalog-selected");
      const ids = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids)) setSelected(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0));
      const stored = sessionStorage.getItem("tpp-catalog-cards");
      if (stored) setKnownCards(JSON.parse(stored));
    } catch {
      // A bad saved selection just starts empty.
    }
    setSelectionReady(true);
  }, []);
  useEffect(() => {
    setKnownCards((current) => {
      const next = { ...current };
      for (const product of products) next[product.id] = product;
      return next;
    });
  }, [products]);
  useEffect(() => {
    if (!selectionReady) return;
    sessionStorage.setItem("tpp-catalog-selected", JSON.stringify(selected));
    const keep: Record<number, ProductCard> = {};
    for (const id of selected) {
      const card = knownCards[id];
      if (card) keep[id] = card;
    }
    sessionStorage.setItem("tpp-catalog-cards", JSON.stringify(keep));
  }, [selected, knownCards, selectionReady]);
  useEffect(() => subscribeJobs(() => setTracked(readTrackedJobs())), []);
  const [rows, setRows] = useState<ProgressRow[] | null>(null);
  const [jobLabel, setJobLabel] = useState<string | null>(null);
  const [jobCounts, setJobCounts] = useState<{ added: number; skipped: number; failed: number; status: string } | null>(null);
  const [view, setView] = useState<Receipt[] | null>(null);
  const [viewProduct, setViewProduct] = useState<ProductCard | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTitle, setViewTitle] = useState("");
  const [task, setTask] = useState<"add" | "remove">("add");
  const [drafts, setDrafts] = useState<ListingDraft[] | null>(null);
  const [removeAsk, setRemoveAsk] = useState<{ product: ProductCard; shop?: string } | null>(null);

  const dialogOpen = rows !== null || jobLabel !== null || view !== null || viewLoading;
  const progress = jobProgress(tracked);
  useEffect(() => {
    setCatalogDialogOpen(drafts !== null || dialogOpen);
    return () => setCatalogDialogOpen(false);
  }, [drafts, dialogOpen]);

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
      .map((id) => knownCards[id] || products.find((product) => product.id === id))
      .filter((product): product is ProductCard => Boolean(product));
    if (queue.length === 0) return;
    setView(null);
    setRows(null);
    setDrafts(queue.map((product) => draftFromProduct(product, queue.length === 1)));
  }

  async function selectScope(scope: "search" | "catalog") {
    setSelecting(true);
    try {
      const params = new URLSearchParams({ cards: "1", scope });
      if (scope === "search") {
        if (keyword) params.set("q", keyword);
        if (categoryId) params.set("category", categoryId);
        if (inStock) params.set("stock", "1");
      }
      const res = await fetch(`/api/portal/shopify-channel/listings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not select those products");
      const cards = (data.products || []) as ProductCard[];
      setKnownCards((current) => {
        const next = { ...current };
        for (const card of cards) next[card.id] = { ...current[card.id], ...card, variants: current[card.id]?.variants || card.variants };
        return next;
      });
      setSelected([...new Set(cards.map((card) => card.id))]);
    } catch (error) {
      setRows([{ id: 0, name: "Selection", state: "failed", receipts: [], error: error instanceof Error ? error.message : "Could not select those products" }]);
    } finally {
      setSelecting(false);
    }
  }

  async function publishDrafts() {
    const queue = drafts;
    const targets = chosenStores();
    if (!queue || queue.length === 0 || !canAdd || !ready || targets.length === 0) return;
    const pushes: Record<string, ReturnType<typeof pushFromDraft>> = {};
    for (const draft of queue) {
      if (draft.touched) pushes[String(draft.productId)] = pushFromDraft(draft);
    }
    setDrafts(null);
    setPending(true);
    setView(null);
    setTask("add");
    try {
      const res = await fetch("/api/portal/shopify-channel/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "selection",
          bcProductIds: queue.map((draft) => draft.productId),
          connectionIds: targets.map((store) => store.id),
          push: { priceMode: "retail" },
          pushes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add");
      if (data.receipt) {
        setRows([{ id: queue[0].productId, name: queue[0].name, state: data.receipt.status === "failed" ? "failed" : "done", receipts: [data.receipt] }]);
        setKnownListed((current) => [...new Set([...current, queue[0].productId])]);
        setSelected((current) => current.filter((id) => id !== queue[0].productId));
      } else {
        trackCatalogJobs((data.jobIds || []) as string[], queue.length);
        setSelected([]);
        setJobLabel("Adding to your Shopify store");
        setRows(null);
      }
    } catch (error) {
      setRows([{ id: 0, name: "Add to Shopify", state: "failed", receipts: [], error: error instanceof Error ? error.message : "Could not add" }]);
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

  function askRemove(product: ProductCard, shop?: string) {
    setRemoveAsk({ product, shop });
  }

  async function removeListed(product: ProductCard, shop?: string) {
    setRemoveAsk(null);
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
  const reason = !canAdd ? "You can look through the catalog. An owner or admin can add products." : "Agree to the terms, save a card, and connect your store. Then you can add products.";

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
                <SortHead label="Your cost" tip="What we charge your card when your customer pays. Shipping in the US is free. Your Shopify price can be higher or lower. We still charge this cost." active={sort === "cost"} dir={dir} href={sortHref("cost")} />
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
                          <button type="button" disabled={pending} onClick={() => askRemove(product)} className={removeBtn}>Remove</button>
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
                      {loadFailed ? "We couldn't load the catalog. Refresh the page and try again." : "Clear the search or pick another category."}
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
            {Boolean(keyword || categoryId || inStock) && matchCount !== catalogCount && (
              <button type="button" disabled={blocked || pending || selecting || matchCount === 0} onClick={() => selectScope("search")} className={channelGhostBtn}>
                {selecting ? "Selecting…" : `Select this search (${matchCount})`}
              </button>
            )}
            <button type="button" disabled={blocked || pending || selecting || catalogCount === 0} onClick={() => selectScope("catalog")} className={channelGhostBtn}>
              {selecting ? "Selecting…" : `Select entire catalog (${catalogCount})`}
            </button>
          </div>
        </div>
      </div>

      <Dialog open={drafts !== null} onOpenChange={(open) => { if (!open) setDrafts(null); }}>
        <DialogContent className={drafts && drafts.length > 1 ? "sm:max-w-5xl" : "sm:max-w-3xl"}>
          <DialogHeader>
            <DialogTitle>{drafts && drafts.length === 1 ? "Add to your Shopify store" : `Add ${drafts?.length || 0} products`}</DialogTitle>
            <DialogDescription>Each product starts at the retail price with no SKU. Click a product if you want to change the price or add your SKU. You don't have to.</DialogDescription>
          </DialogHeader>
          {drafts && drafts.length === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {drafts[0].image && <img src={drafts[0].image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
                <p className="font-semibold leading-6 text-[#1a1a1a]">{drafts[0].name}</p>
              </div>
              <DraftEditor draft={drafts[0]} onChange={(next) => setDrafts([next])} />
              <button type="button" onClick={() => publishDrafts()} className={channelPrimaryBtn}>Add to Shopify</button>
            </div>
          )}
          {drafts && drafts.length > 1 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["retail", "20", "35", "50"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={channelGhostBtn}
                    onClick={() => setDrafts(drafts.map((row) => applyDraftMode(row, mode)))}
                  >
                    {mode === "retail" ? "Set all to retail" : `Set all ${mode}% more`}
                  </button>
                ))}
              </div>
              {drafts.map((draft, index) => (
                <div key={draft.productId} className="rounded-xl border border-[#e7e1de]">
                  <button
                    type="button"
                    onClick={() => setDrafts(drafts.map((row, rowIndex) => rowIndex === index ? { ...row, open: !row.open } : row))}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block font-medium text-[#1a1a1a]">{draft.name}</span>
                      <span className="text-sm text-[#5c5654]">{draft.touched ? draftSummary(draft) : "Retail price · no SKU"}</span>
                    </span>
                    <span className={cn("shrink-0 text-xs font-semibold", draft.touched && !draft.open ? "text-emerald-700" : "text-[#B8282E]")}>
                      {draft.open ? "Close" : draft.touched ? "Price set" : "Click to set price or SKU"}
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
              <button type="button" onClick={() => publishDrafts()} className={channelPrimaryBtn}>
                Add {drafts.length} to Shopify
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {viewLoading ? "Opening the listing" : view ? viewTitle || "On your Shopify store" : task === "remove" ? (pending ? "Removing from your Shopify store" : "Removed from your Shopify store") : jobLabel ? jobLabel : rows?.some((row) => row.state === "adding" || row.state === "waiting") ? "Adding to your Shopify store" : "Added to your Shopify store"}
            </DialogTitle>
            <DialogDescription>
              {viewLoading
                ? "Loading the price, stock, and the link on your store."
                : view
                  ? "This is the listing on your Shopify store."
                  : jobLabel
                    ? "You can close this window. We'll email you when it finishes, including any price or SKU you set."
                    : "The price is the retail price. Change it later in Shopify if you want a different sale price."}
            </DialogDescription>
          </DialogHeader>

          {viewLoading && (
            <div className="flex items-center gap-3 py-6 text-sm text-[#3f3a38]">
              <Loader2 className="h-5 w-5 animate-spin text-[#B8282E]" />
              Opening this listing…
            </div>
          )}

          {jobLabel && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-[#3f3a38]">
                {tracked.length > 0 && <Loader2 className="h-5 w-5 animate-spin text-[#B8282E]" />}
                <p>
                  {tracked.length === 0
                    ? "Finished. We emailed you what was added, including any price or SKU you set."
                    : `${progress.done} of ${progress.total || "…"}${progress.minutesLeft ? ` · about ${progress.minutesLeft} min left` : ""}`}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f0ebe8]">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 8}%` }}
                />
              </div>
              {progress.current && <p className="text-sm text-[#5c5654]">{progress.current}</p>}
              <p className="text-sm text-[#5c5654]">You can close this window. We'll email you when it's finished.</p>
              {tracked.length === 0 && <a className={channelPrimaryBtn} href="/catalog?view=added">See products on your store</a>}
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
                <ReceiptBody key={`${receipt.shopDomain}-${index}`} receipt={receipt} onRemove={viewProduct ? () => askRemove(viewProduct, receipt.shopDomain) : undefined} />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removeAsk !== null} onOpenChange={(open) => { if (!open) setRemoveAsk(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this product?</DialogTitle>
            <DialogDescription>
              {removeAsk
                ? `Remove “${removeAsk.product.name}”${removeAsk.shop ? ` from ${removeAsk.shop}` : " from your Shopify store"}. The listing is deleted. Orders already placed stay as they are.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={channelGhostBtn} onClick={() => setRemoveAsk(null)}>Keep it</button>
            <button
              type="button"
              className={removeBtn}
              onClick={() => { if (removeAsk) void removeListed(removeAsk.product, removeAsk.shop); }}
            >
              Remove
            </button>
          </div>
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
