import { bc } from "@/lib/bigcommerce/client";
import { wholesaleUnitCost } from "@/lib/shopify-channel/money";
import { CatalogBoard } from "./catalog-board";

export function CatalogTableSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="h-12 rounded-2xl bg-white shadow-sm" />
      <div className="overflow-hidden rounded-2xl border border-[#e7e1de] bg-white shadow-[0_10px_30px_rgba(45,45,45,0.05)]">
        <div className="h-11 bg-[#2d2d2d]" />
        <div className="space-y-3 px-4 py-4">
          <div className="h-14 rounded-xl bg-[#f6f3f1]" />
          <div className="h-14 rounded-xl bg-[#f6f3f1]" />
          <div className="h-14 rounded-xl bg-[#f6f3f1]" />
          <p className="text-sm text-[#5c5654]">Loading products…</p>
        </div>
      </div>
    </div>
  );
}

export async function CatalogBrowse({
  percent,
  canAdd,
  stores,
  listedIds,
  keyword,
  categoryId,
  sortKey,
  dir,
  inStock,
  page,
}: {
  percent: number;
  canAdd: boolean;
  stores: Array<{ id: string; shopDomain: string }>;
  listedIds: number[];
  keyword: string;
  categoryId: string;
  sortKey: string;
  dir: "asc" | "desc";
  inStock: boolean;
  page: number;
}) {
  const bcSort = sortKey === "stock" ? "inventory_level" : sortKey === "cost" || sortKey === "margin" ? "price" : sortKey;
  const category = categoryId ? Number(categoryId) : undefined;
  const query = {
    is_visible: true as const,
    keyword: keyword || undefined,
    categoryId: category && Number.isInteger(category) ? category : undefined,
    sort: bcSort,
    direction: dir,
    inStock,
    include: "images,variants",
    limit: 24,
    page,
  };
  let products: Awaited<ReturnType<ReturnType<typeof bc>["getProducts"]>>["data"] = [];
  let matchCount = 0;
  let catalogCount = 0;
  let loadFailed = false;
  let categories: Array<{ id: number; name: string }> = [];
  let categoryCounts: Record<number, number> = {};
  try {
    const [result, all, categoryRows, counts] = await Promise.all([
      bc().getProducts(query),
      bc().getProducts({ is_visible: true, limit: 1 }),
      bc().getCategories().catch(() => []),
      bc().getVisibleCategoryCounts().catch((): Record<number, number> => ({})),
    ]);
    products = result.data || [];
    matchCount = result.meta?.pagination?.total || products.length;
    catalogCount = all.meta?.pagination?.total || 0;
    categories = categoryRows;
    categoryCounts = counts;
  } catch {
    loadFailed = true;
    products = [];
  }

  return (
    <CatalogBoard
      products={products.map((product) => {
        const retail = Number(product.calculated_price || product.price || 0);
        const image = product.images?.find((row) => row.is_thumbnail) || product.images?.[0];
        return {
          id: product.id,
          name: product.name,
          image: image?.url_thumbnail,
          stock: product.inventory_level,
          retail,
          cost: wholesaleUnitCost(retail, percent),
          variants: (product.variants || []).length > 1
            ? (product.variants || []).map((variant, index) => {
                const variantRetail = Number(variant.calculated_price || variant.price || retail);
                const label = (variant.option_values || []).map((option) => option.label).filter(Boolean).join(" / ") || `Option ${index + 1}`;
                return {
                  id: variant.id,
                  label,
                  retail: variantRetail,
                  cost: wholesaleUnitCost(variantRetail, percent),
                  stock: variant.inventory_level,
                };
              })
            : [],
        };
      })}
      stores={stores}
      ready={true}
      canAdd={canAdd}
      keyword={keyword}
      categoryId={categoryId}
      matchCount={matchCount}
      catalogCount={catalogCount}
      page={page}
      sort={sortKey}
      dir={dir}
      inStock={inStock}
      categories={categories.map((row) => ({ id: row.id, name: row.name, count: categoryCounts[row.id] || 0 }))}
      loadFailed={loadFailed}
      listedIds={listedIds}
    />
  );
}
