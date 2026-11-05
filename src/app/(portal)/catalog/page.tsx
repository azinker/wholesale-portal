import { Suspense } from "react";
import { bc } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { loadChannelSetup } from "@/lib/shopify-channel/setup";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { wholesaleUnitCost } from "@/lib/shopify-channel/money";
import { AddedBoard } from "./catalog-added";
import { CatalogBrowse, CatalogTableSkeleton } from "./catalog-browse";
import { priceLabel } from "./catalog-price";
import { CatalogTabs } from "./catalog-tabs";
import { ChannelSchemaNotice } from "../channel-schema-notice";
import { ChannelSetupGate } from "../channel-setup-gate";
import { ChannelHeading, ChannelPage, ChannelPanel } from "../channel-ui";

const FLOW = [
  { title: "Add a product", body: "It starts at the same price as our site. You can change the price, or add your own SKU, before it goes to your store." },
  { title: "Your customer pays you", body: "They pay on your Shopify store. We never charge your customer." },
  { title: "We charge your card", body: "We charge your wholesale cost when they pay. It shows on your statement as THE PERFECT PART." },
  { title: "We ship it", body: "We ship the same day or the next business day, and put tracking on your Shopify order." },
];

export const dynamic = "force-dynamic";

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
  const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : sortKey === "name" ? "asc" : "desc";
  const inStock = params.stock === "1";
  const page = Math.max(1, Number(params.page || "1") || 1);
  const canAdd = userHasPermission(user, "manage_channel_listings");
  const view = params.view === "added" ? "added" : "browse";
  const [earned, welcome, listingRows] = await Promise.all([
    getTierDiscountPercent(account.lastTier),
    loadWelcomeConfig(),
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
  const listedIds = [...new Set(listingRows.map((row) => row.bcProductId))];
  const addedFiltered = view === "added"
    ? [...groups.values()].filter((row) => {
        if (!q) return true;
        return `${row.title} ${row.skus.join(" ")} ${row.shop}`.toLowerCase().includes(q.toLowerCase());
      })
    : [];
  const addedPageCount = Math.max(1, Math.ceil(addedFiltered.length / 24));
  const addedSlice = addedFiltered.slice((page - 1) * 24, page * 24);

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify"
        title="Catalog"
        lede={view === "added" ? "These products are already on your Shopify store." : "Pick a product and add it to your Shopify store. Your customer pays you. We charge your card and ship it."}
      />
      <CatalogTabs count={addedCount} view={view} />

      {view === "browse" && (
        <>
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
        </>
      )}

      {preview && (
        <ChannelPanel className="border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Only you can see this while we finish testing. Other wholesalers still use their regular dashboard.
        </ChannelPanel>
      )}

      {view === "added" ? (
        <Suspense fallback={<CatalogTableSkeleton />}>
          <AddedListing
            rows={addedSlice}
            page={Math.min(page, addedPageCount)}
            pageCount={addedPageCount}
            query={q}
            total={addedFiltered.length}
            percent={percent}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<CatalogTableSkeleton />}>
          <CatalogBrowse
            percent={percent}
            canAdd={canAdd}
            stores={setup.stores.map((store) => ({ id: store.id, shopDomain: store.shopDomain }))}
            listedIds={listedIds}
            keyword={q}
            categoryId={category}
            sortKey={sortKey}
            dir={dir}
            inStock={inStock}
            page={page}
          />
        </Suspense>
      )}
    </ChannelPage>
  );
}

async function AddedListing({
  rows,
  page,
  pageCount,
  query,
  total,
  percent,
}: {
  rows: Array<{ key: string; bcProductId: number; title: string; shop: string; shopifyProductId: string; skus: string[]; prices: number[] }>;
  page: number;
  pageCount: number;
  query: string;
  total: number;
  percent: number;
}) {
  const products = rows.length ? await bc().getProductsByIds(rows.map((row) => row.bcProductId)).catch(() => []) : [];
  const byId = new Map(products.map((product) => [product.id, product]));
  return (
    <AddedBoard
      rows={rows.map((row) => {
        const product = byId.get(row.bcProductId);
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
      page={page}
      pageCount={pageCount}
      query={query}
      total={total}
    />
  );
}
