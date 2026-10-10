"use client";

import { Tip } from "../tip";
import { channelField, money } from "../channel-ui";
import { cn } from "@/lib/utils";

export type CatalogVariant = {
  id: number;
  label: string;
  retail: number;
  cost: number;
  stock: number;
};

export type DraftProduct = {
  id: number;
  name: string;
  image?: string;
  stock: number;
  retail: number;
  cost: number;
  variants?: CatalogVariant[];
};

type PriceMode = "retail" | "20" | "35" | "50" | "custom";

export type DraftVariant = CatalogVariant & { listPrice: string; sku: string };

export type ListingDraft = {
  productId: number;
  name: string;
  image?: string;
  retail: number;
  cost: number;
  stock: number;
  priceMode: PriceMode;
  listPrice: string;
  sku: string;
  compareAt: string;
  productType: string;
  variants: DraftVariant[];
  open: boolean;
  saved: boolean;
};

const modes: Array<{ id: PriceMode; label: string }> = [
  { id: "retail", label: "Retail" },
  { id: "20", label: "20% more" },
  { id: "35", label: "35% more" },
  { id: "50", label: "50% more" },
  { id: "custom", label: "Your price" },
];

function amount(retail: number, cost: number, mode: PriceMode): string {
  if (mode === "20") return (cost * 1.2).toFixed(2);
  if (mode === "35") return (cost * 1.35).toFixed(2);
  if (mode === "50") return (cost * 1.5).toFixed(2);
  return retail.toFixed(2);
}

export function draftFromProduct(product: DraftProduct, open: boolean): ListingDraft {
  const variants = (product.variants || []).filter((variant) => variant.id > 0);
  return {
    productId: product.id,
    name: product.name,
    image: product.image,
    retail: product.retail,
    cost: product.cost,
    stock: product.stock,
    priceMode: "retail",
    listPrice: product.retail.toFixed(2),
    sku: "",
    compareAt: "",
    productType: "",
    variants: variants.map((variant) => ({
      ...variant,
      listPrice: variant.retail.toFixed(2),
      sku: "",
    })),
    open,
    saved: !open,
  };
}

export function pushFromDraft(draft: ListingDraft) {
  const compare = Number(draft.compareAt);
  const productType = draft.productType.trim();
  if (draft.variants.length > 0) {
    return {
      priceMode: "retail" as const,
      compareAt: compare > 0 ? compare : undefined,
      productType: productType || undefined,
      variants: draft.variants.map((variant) => ({
        bcVariantId: variant.id,
        price: Number(variant.listPrice) > 0 ? Number(variant.listPrice) : variant.retail,
        sku: variant.sku.trim() || undefined,
      })),
    };
  }
  const list = Number(draft.listPrice);
  const custom = Number.isFinite(list) && list > 0 && Math.abs(list - draft.retail) >= 0.001;
  return {
    priceMode: custom ? ("custom" as const) : ("retail" as const),
    customPrice: custom ? list : undefined,
    sellerSku: draft.sku.trim() || undefined,
    compareAt: compare > 0 ? compare : undefined,
    productType: productType || undefined,
  };
}

function applyMode(draft: ListingDraft, mode: PriceMode): ListingDraft {
  if (draft.variants.length > 0) {
    return {
      ...draft,
      priceMode: mode,
      saved: false,
      variants: draft.variants.map((variant) => ({
        ...variant,
        listPrice: mode === "custom" ? variant.listPrice : amount(variant.retail, variant.cost, mode),
      })),
    };
  }
  return {
    ...draft,
    priceMode: mode,
    saved: false,
    listPrice: mode === "custom" ? draft.listPrice : amount(draft.retail, draft.cost, mode),
  };
}

function shownPrice(draft: ListingDraft): string {
  if (draft.variants.length === 0) return money(Number(draft.listPrice) || draft.retail);
  const prices = draft.variants.map((variant) => Number(variant.listPrice) || variant.retail);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? money(low) : `${money(low)}–${money(high)}`;
}

function Field({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-[#3f3a38]">
      <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#5c5654]">
        {label}
        <Tip text={tip} />
      </span>
      {children}
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a8481]">$</span>
      <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className={cn(channelField, "pl-7")} />
    </div>
  );
}

function Keep({ amount: margin }: { amount: number }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", margin < 0 ? "bg-red-50 text-[#B8282E]" : "bg-emerald-50 text-emerald-800")}>
      You keep {money(margin)}
    </span>
  );
}

export function DraftEditor({
  draft,
  onChange,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
}) {
  const list = Number(draft.listPrice) || draft.retail;
  const margin = list - draft.cost;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[#f6f3f1] px-3 py-2.5">
          <p className="text-xs text-[#5c5654]">Your cost</p>
          <p className="font-display text-lg font-semibold">{draft.variants.length ? "Per option" : money(draft.cost)}</p>
        </div>
        <div className="rounded-xl bg-[#f6f3f1] px-3 py-2.5">
          <p className="text-xs text-[#5c5654]">In stock</p>
          <p className="font-display text-lg font-semibold">{draft.stock}</p>
        </div>
        {draft.variants.length === 0 && (
          <div className={cn("col-span-2 rounded-xl px-3 py-2.5 sm:col-span-1", margin < 0 ? "bg-red-50" : "bg-emerald-50")}>
            <p className={cn("text-xs", margin < 0 ? "text-[#B8282E]" : "text-emerald-800")}>You keep</p>
            <p className={cn("font-display text-lg font-semibold", margin < 0 ? "text-[#B8282E]" : "text-emerald-800")}>{money(margin)}</p>
          </div>
        )}
      </div>

      <div className="sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-1 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5c5654]">Price on your store</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(applyMode(draft, mode.id))}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                draft.priceMode === mode.id ? "bg-primary text-white" : "bg-[#f6f3f1] text-[#3f3a38] hover:bg-[#efeae7]"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm leading-5 text-[#5c5654]">
          {draft.variants.length > 0
            ? "These set every option. You can still change one row. We charge your cost when the customer pays."
            : "Retail is the price on theperfectpart.net. We charge your cost when the customer pays."}
        </p>
      </div>

      {draft.variants.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your price" tip="What your customer pays on Shopify. It starts at the retail price. You can change it later in Shopify too.">
            <MoneyInput value={draft.listPrice} onChange={(value) => onChange({ ...draft, priceMode: "custom", listPrice: value, saved: false })} />
          </Field>
          <Field label="Your SKU" tip="Optional. Your own code on Shopify. Leave it blank if you don't need one.">
            <input
              value={draft.sku}
              onChange={(event) => onChange({ ...draft, sku: event.target.value, saved: false })}
              placeholder="Optional"
              className={channelField}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_9rem_9rem_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[#5c5654] md:grid">
            <span>Option</span>
            <span>Your price</span>
            <span>Your SKU</span>
            <span>You keep</span>
          </div>
          {draft.variants.map((variant, index) => {
            const variantList = Number(variant.listPrice) || variant.retail;
            const variantMargin = variantList - variant.cost;
            return (
              <div key={variant.id} className="grid items-center gap-3 rounded-xl border border-[#efeae7] bg-[#fbfaf9] p-3 md:grid-cols-[minmax(0,1.3fr)_9rem_9rem_auto]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#1a1a1a]">{variant.label}</p>
                  <p className="text-xs text-[#5c5654]">Cost {money(variant.cost)} · {variant.stock} in stock</p>
                </div>
                <MoneyInput
                  value={variant.listPrice}
                  onChange={(value) => {
                    const variants = draft.variants.slice();
                    variants[index] = { ...variant, listPrice: value };
                    onChange({ ...draft, priceMode: "custom", variants, saved: false });
                  }}
                />
                <input
                  value={variant.sku}
                  onChange={(event) => {
                    const variants = draft.variants.slice();
                    variants[index] = { ...variant, sku: event.target.value };
                    onChange({ ...draft, variants, saved: false });
                  }}
                  placeholder="Optional"
                  aria-label={`SKU for ${variant.label}`}
                  className={channelField}
                />
                <Keep amount={variantMargin} />
              </div>
            );
          })}
        </div>
      )}

      <details className="rounded-xl bg-[#f6f3f1] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#1a1a1a]">More options</summary>
        <p className="mt-1 text-sm text-[#5c5654]">Optional. Most stores skip this.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Compare-at price" tip="A higher crossed-out price, like a sale. We only send it when it is above your price.">
            <MoneyInput value={draft.compareAt} onChange={(value) => onChange({ ...draft, compareAt: value, saved: false })} />
          </Field>
          <Field label="Product type" tip="A label in Shopify, such as Home or Tools. Leave blank to skip it.">
            <input
              value={draft.productType}
              onChange={(event) => onChange({ ...draft, productType: event.target.value, saved: false })}
              placeholder="Home, Tools…"
              className={channelField}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

export function draftSummary(draft: ListingDraft): string {
  if (draft.variants.length > 0) {
    const withSku = draft.variants.filter((variant) => variant.sku.trim()).length;
    return `${shownPrice(draft)} · ${draft.variants.length} options${withSku ? ` · ${withSku} SKU${withSku === 1 ? "" : "s"}` : ""}`;
  }
  return `${shownPrice(draft)}${draft.sku.trim() ? ` · SKU ${draft.sku.trim()}` : " · No SKU"}`;
}
