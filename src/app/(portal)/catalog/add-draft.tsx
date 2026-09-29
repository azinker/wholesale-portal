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
  { id: "retail", label: "Retail price" },
  { id: "20", label: "20% above cost" },
  { id: "35", label: "35% above cost" },
  { id: "50", label: "50% above cost" },
  { id: "custom", label: "Custom price" },
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
      <span className="inline-flex items-center gap-1.5">
        {label}
        <Tip text={tip} />
      </span>
      {children}
    </label>
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
      <div>
        <p className="text-sm text-[#5c5654]">Your cost {money(draft.cost)} · Stock {draft.stock}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(applyMode(draft, mode.id))}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                draft.priceMode === mode.id ? "border-[#2d2d2d] bg-[#2d2d2d] text-white" : "border-[#e4ddd9] bg-white text-[#3f3a38] hover:border-[#2d2d2d]"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      {draft.variants.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lists at" tip="The price on your Shopify store. It starts at the theperfectpart.net retail price. You can raise it, lower it, or type any price. You can also change it later in Shopify. We still charge your cost when the customer pays.">
            <input
              inputMode="decimal"
              value={draft.listPrice}
              onChange={(event) => onChange({ ...draft, priceMode: "custom", listPrice: event.target.value, saved: false })}
              className={cn(channelField, "mt-1")}
            />
          </Field>
          <Field label="Your Shopify SKU" tip="Optional. This is your own SKU on Shopify. Leave it blank if you don't need one. We still know which product was sold.">
            <input
              value={draft.sku}
              onChange={(event) => onChange({ ...draft, sku: event.target.value, saved: false })}
              placeholder="Optional"
              className={cn(channelField, "mt-1")}
            />
          </Field>
          <p className={cn("text-sm font-semibold sm:col-span-2", margin < 0 ? "text-[#B8282E]" : "text-emerald-700")}>
            Margin {money(margin)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#5c5654]">Each option has its own price and SKU. The buttons above set every option. Retail is the starting price.</p>
          {draft.variants.map((variant, index) => {
            const variantList = Number(variant.listPrice) || variant.retail;
            const variantMargin = variantList - variant.cost;
            return (
              <div key={variant.id} className="rounded-xl border border-[#f0ebe8] p-3">
                <p className="font-medium text-[#1a1a1a]">{variant.label}</p>
                <p className="text-xs text-[#5c5654]">Your cost {money(variant.cost)} · Stock {variant.stock}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label="Lists at" tip="The Shopify price for this option. It starts at that option's retail price. Changing it does not change the cost we charge.">
                    <input
                      inputMode="decimal"
                      value={variant.listPrice}
                      onChange={(event) => {
                        const variants = draft.variants.slice();
                        variants[index] = { ...variant, listPrice: event.target.value };
                        onChange({ ...draft, priceMode: "custom", variants, saved: false });
                      }}
                      className={cn(channelField, "mt-1")}
                    />
                  </Field>
                  <Field label="Your SKU for this option" tip="Optional. Your own SKU for this option. Leave it blank if you don't need one. We still match the sale to this product.">
                    <input
                      value={variant.sku}
                      onChange={(event) => {
                        const variants = draft.variants.slice();
                        variants[index] = { ...variant, sku: event.target.value };
                        onChange({ ...draft, variants, saved: false });
                      }}
                      placeholder="Optional"
                      className={cn(channelField, "mt-1")}
                    />
                  </Field>
                </div>
                <p className={cn("mt-2 text-sm font-semibold", variantMargin < 0 ? "text-[#B8282E]" : "text-emerald-700")}>
                  Margin {money(variantMargin)}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Compare-at price" tip="Optional. A higher crossed-out price on your store, like a sale. We'll only use it when it's above your list price.">
          <input
            inputMode="decimal"
            value={draft.compareAt}
            onChange={(event) => onChange({ ...draft, compareAt: event.target.value, saved: false })}
            placeholder="Optional"
            className={cn(channelField, "mt-1")}
          />
        </Field>
        <Field label="Product type" tip="Optional label in Shopify, such as Home or Tools. Leave blank to skip it.">
          <input
            value={draft.productType}
            onChange={(event) => onChange({ ...draft, productType: event.target.value, saved: false })}
            placeholder="Optional, such as Home"
            className={cn(channelField, "mt-1")}
          />
        </Field>
      </div>
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
