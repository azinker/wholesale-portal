import Link from "next/link";
import { bc } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { wholesaleUnitCost } from "@/lib/shopify-channel/money";
import { alignListingImages } from "@/lib/shopify-channel/publish";
import { CatalogBoard } from "./catalog-board";
import { ChannelSchemaNotice } from "../channel-schema-notice";
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
  searchParams: Promise<{ q?: string; category?: string; sort?: string; dir?: string; stock?: string; page?: string }>;
}) {
  const { user, account, preview, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
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
  const [terms, card, stores, earned, welcome, categories, categoryCounts] = await Promise.all([
    db.shopifyTermsAcceptance.findUnique({
      where: { accountId_version: { accountId: account.id, version: SHOPIFY_CHANNEL_TERMS_VERSION } },
    }),
    db.sellerPaymentMethod.findUnique({ where: { accountId: account.id } }),
    db.shopifyConnection.findMany({
      where: {
        accountId: account.id,
        disconnectedAt: null,
        addressTestStatus: "PASSED",
        NOT: { shopDomain: { startsWith: "preview-" } },
      },
    }),
    getTierDiscountPercent(account.lastTier),
    loadWelcomeConfig(),
    bc().getCategories().catch(() => []),
    bc().getVisibleCategoryCounts().catch((): Record<number, number> => ({})),
  ]);
  const percent =
    isWelcomeActive(account.welcomeExpiresAt) && welcome.enabled && welcome.discount > earned
      ? welcome.discount
      : earned;
  const ready = Boolean(terms && card && stores.length > 0);
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

  const setup = [
    { done: Boolean(terms), label: "Terms", href: "/my-shopify#terms" },
    { done: Boolean(card), label: card ? `Credit card ···· ${card.last4}` : "Credit card", href: "/billing" },
    { done: stores.length > 0, label: stores.length ? `${stores.length} store ready` : "Store", href: "/my-shopify#connect" },
  ];

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify"
        title="Catalog"
        lede="Pick a product and add it to your Shopify store. Your customer pays you. We charge your card and ship it."
      />

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

      {!ready && (
        <ChannelPanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-semibold text-[#1a1a1a]">You're almost ready to add products</p>
            <p className="text-sm text-[#5c5654]">Agree to the terms, save a card, and connect your store.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {setup.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${item.done ? "bg-emerald-50 text-emerald-800" : "bg-[#2d2d2d] text-white"}`}
              >
                {item.done ? item.label : `Do ${item.label}`}
              </Link>
            ))}
          </div>
        </ChannelPanel>
      )}

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
        ready={ready}
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
    </ChannelPage>
  );
}
