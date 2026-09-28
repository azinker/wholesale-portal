import Link from "next/link";
import { bc } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { wholesaleUnitCost } from "@/lib/shopify-channel/money";
import { CatalogBoard } from "./catalog-board";
import { ChannelSchemaNotice } from "../channel-schema-notice";
import { ChannelHeading, ChannelPage, ChannelPanel } from "../channel-ui";

const FLOW = [
  { title: "Add a product", body: "It lands on your Shopify store at the retail price. Change the price later in Shopify." },
  { title: "Your customer pays you", body: "The sale stays on your store. We never charge your customer." },
  { title: "We charge your credit card", body: "The wholesale cost that day. The statement says THE PERFECT PART." },
  { title: "We ship it", body: "Same day or the next business day. Tracking goes onto your Shopify order." },
];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; stock?: string; page?: string }>;
}) {
  const { user, account, preview, schemaReady } = await requireChannelAccount();
  if (!schemaReady) return <ChannelSchemaNotice />;
  const params = await searchParams;
  const q = params.q || "";
  const category = params.category || "";
  const sort = params.sort || "total_sold";
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
    sort,
    direction: sort === "name" ? "asc" : "desc",
    inStock,
    include: "images",
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

  const setup = [
    { done: Boolean(terms), label: "Terms", href: "/my-shopify#terms" },
    { done: Boolean(card), label: card ? `Credit card ···· ${card.last4}` : "Credit card", href: "/billing" },
    { done: stores.length > 0, label: stores.length ? `${stores.length} store ready` : "Store", href: "/my-shopify#connect" },
  ];

  return (
    <ChannelPage>
      <ChannelHeading
        kicker="Shopify channel"
        title="Catalog"
        lede="Pick products, add them to your store, and we fulfill the paid orders. Your cost is today’s wholesale price. Margin is the sale price minus that cost, before Shopify fees."
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
        Shipping inside the US is free, including PO Boxes. Anywhere else is $18.99 once per order. We do not charge tax or duty.
        If we are out of stock, or the credit card does not work, we do not ship and we email you. After the credit card is charged, the address is locked. Cancel or change it in Support before it ships.
      </p>

      {preview && (
        <ChannelPanel className="border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          Preview. Other wholesalers still see Hot Sellers. Add sends the product to the Shopify store you connected. A paid order is saved and is not charged until the channel switch is on.
        </ChannelPanel>
      )}

      {!ready && (
        <ChannelPanel className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-semibold text-[#1a1a1a]">Finish setup before Add turns on</p>
            <p className="text-sm text-[#5c5654]">The terms, a credit card, and a store that passed the address test.</p>
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
        sort={sort}
        inStock={inStock}
        categories={categories.map((row) => ({ id: row.id, name: row.name, count: categoryCounts[row.id] || 0 }))}
        loadFailed={loadFailed}
      />
    </ChannelPage>
  );
}
