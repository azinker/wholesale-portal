import Link from "next/link";
import { bc } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { wholesaleUnitCost } from "@/lib/shopify-channel/money";
import { alignListingImages } from "@/lib/shopify-channel/publish";
import { loadChannelSetup } from "@/lib/shopify-channel/setup";
import { CatalogBoard } from "./catalog-board";
import { AddedBoard, priceLabel } from "./catalog-added";
import { ChannelSchemaNotice } from "../channel-schema-notice";
import { ChannelSetupGate } from "../channel-setup-gate";
import { ChannelHeading, ChannelPage, ChannelPanel } from "../channel-ui";

const FLOW = [
  { title: "Add a product", body: "It starts at the same price as our site. You can change the price, or add your own SKU, before it goes to your store." },
  { title: "Your customer pays you", body: "They pay on your Shopify store. We never charge your customer." },
  { title: "We charge your card", body: "We charge your wholesale cost when they pay. It shows on your statement as THE PERFECT PART." },
  { title: "We ship it", body: "We ship the same day or the next business day, and put tracking on your Shopify order." },
];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; dir?: string; stock?: string; page?: string; view?: string }>;
}) {
  const { user, account, preview, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const setup = await loadChannelSetup(account.id);
  if (!setup.ready) {
    return (
      <ChannelSetupGate
        setup={setup}
        title="Catalog"
        lede="Products, stock, and your cost stay hidden until the terms, a card, and a Shopify store are finished."
      />
    );
  }
  const params = await searchParams;
  const q = params.q || "";
  const category = params.category || "";
  const sortKey = ["name", "stock", "price", "cost", "margin", "total_sold", "date_modified"].includes(params.sort || "")
    ? params.sort || "total_sold"
    : "total_sold";
  const bcSort =
    sortKey === "stock" ? "inventory_level" : sortKey === "cost" || sortKey === "margin" ? "price" : sortKey;
  const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : sortKey === "name" ? "asc" : "desc";
  const inStock = params.stock === "1";
  const page = Math.max(1, Number(params.page || "1") || 1);
  const categoryId = category ? Number(category) : undefined;
  const canAdd = userHasPermission(user, "manage_channel_listings");
  const view = params.view === "added" ? "added" : "browse";
  const [earned, welcome, categories, categoryCounts, listingRows] = await Promise.all([
    getTierDiscountPercent(account.lastTier),
    loadWelcomeConfig(),
    view === "browse" ? bc().getCategories().catch(() => []) : Promise.resolve([]),
    view === "browse" ? bc().getVisibleCategoryCounts().catch((): Record<number, number> => ({})) : Promise.resolve({} as Record<number, number>),
    db.channelListing.findMany({
      where: { accountId: account.id, removedAt: null, connection: { disconnectedAt: null } },
      select: {
        bcProductId: true,
        connectionId: true,
        titleSnapshot: true,
        sellerSku: true,
        sellerPrice: true,
        shopifyProductId: true,
        createdAt: true,
        connection: { select: { shopDomain: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const percent =
    isWelcomeActive(account.welcomeExpiresAt) && welcome.enabled && welcome.discount > earned
      ? welcome.discount
      : earned;
  const stores = setup.stores;
  const query = {
    is_visible: true as const,
    keyword: q || undefined,
    categoryId: categoryId && Number.isInteger(categoryId) ? categoryId : undefined,
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
  try {
    const [result, all] = await Promise.all([
      bc().getProducts(query),
      bc().getProducts({ is_visible: true, limit: 1 }),
    ]);
    products = result.data || [];
    matchCount = result.meta?.pagination?.total || products.length;
    catalogCount = all.meta?.pagination?.total || 0;
  } catch {
    loadFailed = true;
    products = [];
  }

  const listedRows = products.length
    ? await db.channelListing.findMany({
        where: {
          accountId: account.id,
          removedAt: null,
          bcProductId: { in: products.map((product) => product.id) },
          connection: { disconnectedAt: null },
        },
        select: { bcProductId: true, connectionId: true },
      })
    : [];
  const seenPairs = new Set<string>();
  for (const row of listedRows) {
    const pair = `${row.connectionId}:${row.bcProductId}`;
    if (seenPairs.has(pair)) continue;
    seenPairs.add(pair);
    await alignListingImages(row.connectionId, row.bcProductId).catch(() => undefined);
  }

  const groups = new Map<string, { key: string; bcProductId: number; title: string; shop: string; shopifyProductId: string; skus: string[]; prices: number[] }>();
  for (const row of listingRows) {
    const key = `${row.connectionId}:${row.bcProductId}`;
    const sku = (row.sellerSku || "").trim();
    const price = Number(row.sellerPrice);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        bcProductId: row.bcProductId,
        title: row.titleSnapshot,
        shop: row.connection.shopDomain,
        shopifyProductId: row.shopifyProductId,
        skus: sku ? [sku] : [],
        prices: Number.isFinite(price) ? [price] : [],
      });
    } else {
      if (sku && !existing.skus.includes(sku)) existing.skus.push(sku);
      if (Number.isFinite(price) && !existing.prices.includes(price)) existing.prices.push(price);
    }
  }
  const addedCount = groups.size;
  const addedFiltered = view === "added"
    ? [...groups.values()].filter((row) => {
        if (!q) return true;
        return `${row.title} ${row.skus.join(" ")} ${row.shop}`.toLowerCase().includes(q.toLowerCase());
      })
    : [];
  const addedPageCount = Math.max(1, Math.ceil(addedFiltered.length / 24));
  const addedSlice = addedFiltered.slice((page - 1) * 24, page * 24);
  const addedProducts = view === "added" ? await bc().getProductsByIds(addedSlice.map((row) => row.bcProductId)).catch(() => []) : [];
  const addedById = new Map(addedProducts.map((product) => [product.id, product]));

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify"
        title="Catalog"
        lede={view === "added" ? "These products are already on your Shopify store." : "Pick a product and add it to your Shopify store. Your customer pays you. We charge your card and ship it."}
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/catalog" className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "browse" ? "bg-[#2d2d2d] text-white" : "bg-white text-[#1a1a1a]"}`}>Browse catalog</Link>
        <Link href="/catalog?view=added" className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "added" ? "bg-[#2d2d2d] text-white" : "bg-white text-[#1a1a1a]"}`}>On your store ({addedCount})</Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {FLOW.map((step, index) => (
          <ChannelPanel key={step.title} delay={index * 60} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">0{index + 1}</p>
            <p className="mt-2 font-semibold text-[#1a1a1a]">{step.title}</p>
            <p className="mt-1 text-sm leading-6 text-[#5c5654]">{step.body}</p>
          </ChannelPanel>
        ))}
      </div>

      <p className="text-sm leading-6 text-[#5c5654]">
        Shipping in the US is free, including PO Boxes, Alaska, and Hawaii. Everywhere else is $18.99 for the whole order. We don't add tax.
        If we're out of stock, or the card doesn't go through, we'll email you and we won't ship. Once we've charged the card, write to Support if the address needs a change.
      </p>

      {preview && (
        <ChannelPanel className="border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Only you can see this while we finish testing. Other wholesalers still use their regular dashboard.
        </ChannelPanel>
      )}

      {view === "added" ? (
        <AddedBoard
          rows={addedSlice.map((row) => {
            const product = addedById.get(row.bcProductId);
            const image = product?.images?.find((item) => item.is_thumbnail) || product?.images?.[0];
            const retail = Number(product?.calculated_price || product?.price || 0);
            return {
              key: row.key,
              bcProductId: row.bcProductId,
              title: row.title,
              shop: row.shop,
              image: image?.url_thumbnail,
              sku: row.skus.length ? row.skus.join(", ") : "No SKU",
              priceLabel: priceLabel(row.prices),
              costLabel: product ? `$${wholesaleUnitCost(retail, percent).toFixed(2)}` : "—",
              adminUrl: `https://${row.shop}/admin/products/${row.shopifyProductId}`,
            };
          })}
          page={Math.min(page, addedPageCount)}
          pageCount={addedPageCount}
          query={q}
          total={addedFiltered.length}
        />
      ) : (
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
        stores={stores.map((store) => ({ id: store.id, shopDomain: store.shopDomain }))}
        ready={true}
        canAdd={canAdd}
        keyword={q}
        categoryId={category}
        matchCount={matchCount}
        catalogCount={catalogCount}
        page={page}
        sort={sortKey}
        dir={dir}
        inStock={inStock}
        categories={categories.map((row) => ({ id: row.id, name: row.name, count: categoryCounts[row.id] || 0 }))}
        loadFailed={loadFailed}
        listedIds={[...new Set(listedRows.map((row) => row.bcProductId))]}
      />
      )}
    </ChannelPage>
  );
}
