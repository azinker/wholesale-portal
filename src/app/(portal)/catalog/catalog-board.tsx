"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  preview,
  keyword,
  categoryId,
  matchCount,
  catalogCount,
  page,
  sort,
  inStock,
  categories,
}: {
  products: ProductCard[];
  stores: StoreChoice[];
  ready: boolean;
  canAdd: boolean;
  preview: boolean;
  keyword: string;
  categoryId: string;
  matchCount: number;
  catalogCount: number;
  page: number;
  sort: string;
  inStock: boolean;
  categories: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>(stores.length === 1 ? [stores[0].id] : []);
  const [pending, setPending] = useState(false);

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]));
  }

  async function publish(scope: "selection" | "category" | "catalog", ids: number[] = []) {
    if (!canAdd || !ready || preview) return;
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

  const blocked = !ready || !canAdd || preview;
  const reason = preview
    ? "Preview only. Nothing is sent to Shopify until the channel is switched on."
    : !canAdd
      ? "Viewers cannot add products"
      : "Finish setup to add products";

  return (
    <div className="space-y-4 pb-24">
      <form className="grid gap-2 sm:grid-cols-4" action="/catalog">
        <input name="q" defaultValue={keyword} placeholder="Search products" className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2" />
        <select name="category" defaultValue={categoryId} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="total_sold">Best selling</option>
          <option value="name">Name</option>
          <option value="price">Price</option>
          <option value="date_modified">Newest</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={inStock} />
          In stock
        </label>
        <button className="rounded-md border px-3 py-2 text-sm" type="submit">Search</button>
      </form>

      {stores.length > 1 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {stores.map((store) => (
            <label key={store.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={storeIds.includes(store.id)}
                onChange={() =>
                  setStoreIds((current) =>
                    current.includes(store.id) ? current.filter((id) => id !== store.id) : [...current, store.id]
                  )
                }
              />
              {store.shopDomain}
            </label>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <div key={product.id} className="rounded-lg border p-4 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
              <span className="font-medium">{product.name}</span>
            </label>
            {product.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" className="h-32 w-full object-contain" />
            )}
            <p className="text-sm text-muted-foreground">In stock: {product.stock}</p>
            <p className="text-sm">Lists at ${product.retail.toFixed(2)}</p>
            <p className="text-sm">Your cost ${product.cost.toFixed(2)}</p>
            <Button disabled={blocked || pending} title={blocked ? reason : "Adds this product at retail. We email you when it finishes."} onClick={() => publish("selection", [product.id])}>
              Add
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 text-sm">
        {page > 1 && (
          <a className="underline" href={`/catalog?q=${encodeURIComponent(keyword)}&category=${categoryId}&sort=${sort}&stock=${inStock ? "1" : ""}&page=${page - 1}`}>
            Previous
          </a>
        )}
        <a className="underline" href={`/catalog?q=${encodeURIComponent(keyword)}&category=${categoryId}&sort=${sort}&stock=${inStock ? "1" : ""}&page=${page + 1}`}>
          Next
        </a>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2">
          <Button disabled={blocked || pending || selected.length === 0} title="Adds the checked products. Already listed ones are skipped." onClick={() => publish("selection", selected)}>
            Add selected ({selected.length})
          </Button>
          <Button disabled={blocked || pending} title="Example: search brake pads, then add every match in that search. One email when it finishes." onClick={() => publish("category")}>
            Add all in this search ({matchCount})
          </Button>
          <Button disabled={blocked || pending} title="Example: add every visible product. One email when the whole catalog finishes." onClick={() => publish("catalog")}>
            Add entire catalog ({catalogCount})
          </Button>
        </div>
      </div>
    </div>
  );
}
