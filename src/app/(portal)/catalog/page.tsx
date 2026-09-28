import Link from "next/link";
import { bc } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/portal-auth";
import { requireChannelAccount } from "@/lib/shopify-channel/access";
import { SHOPIFY_CHANNEL_TERMS_VERSION } from "@/lib/shopify-channel/constants";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { wholesaleUnitCost } from "@/lib/shopify-channel/money";
import { Card, CardContent } from "@/components/ui/card";
import { CatalogBoard } from "./catalog-board";
import { ChannelSchemaNotice } from "../channel-schema-notice";

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
  const [terms, card, stores, earned, welcome, categories] = await Promise.all([
    db.shopifyTermsAcceptance.findUnique({
      where: { accountId_version: { accountId: account.id, version: SHOPIFY_CHANNEL_TERMS_VERSION } },
    }),
    db.sellerPaymentMethod.findUnique({ where: { accountId: account.id } }),
    db.shopifyConnection.findMany({
      where: { accountId: account.id, disconnectedAt: null, addressTestStatus: "PASSED" },
    }),
    getTierDiscountPercent(account.lastTier),
    loadWelcomeConfig(),
    bc().getCategories().catch(() => []),
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
  try {
    const [result, all] = await Promise.all([
      bc().getProducts(query),
      bc().getProducts({ is_visible: true, limit: 1 }),
    ]);
    products = result.data || [];
    matchCount = result.meta?.pagination?.total || products.length;
    catalogCount = all.meta?.pagination?.total || 0;
  } catch {
    products = [];
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catalog</h1>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Connect your store, save a card, and accept the terms.</li>
          <li>Add products. They appear on your Shopify store at the retail price. You can change the price later in Shopify.</li>
          <li>Your customer pays you. We charge your card the wholesale cost that day. The statement says THE PERFECT PART.</li>
          <li>Shipping inside the US is free, including PO Boxes. Outside the US we add $18.99 once per order. We do not charge tax or duty.</li>
          <li>Your margin is what your customer paid minus what we charged, before Shopify fees.</li>
          <li>We ship the same day or the next business day. Tracking goes onto your Shopify order.</li>
          <li>If we are out of stock or the card does not work, we do not ship, and we email you.</li>
          <li>After we charge the card, the address is locked. To cancel or change it, contact Support with the order number before it ships.</li>
        </ul>
      </div>
      {preview && (
        <Card>
          <CardContent className="pt-6 text-sm">
            Preview only. Other wholesalers still see Hot Sellers. Add does not send products to Shopify, and a sale is not charged, until the channel switch is on.
          </CardContent>
        </Card>
      )}
      {!ready && (
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <p>Finish setup before Add turns on.</p>
            <p>{terms ? "Terms accepted." : <Link href="/my-shopify">Accept the Shopify Channel Terms.</Link>}</p>
            <p>{card ? `Card on file ending ${card.last4}.` : <Link href="/billing">Save a card in Billing.</Link>}</p>
            <p>{stores.length ? `${stores.length} store ready.` : <Link href="/my-shopify">Connect a store and pass the address test.</Link>}</p>
          </CardContent>
        </Card>
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
        preview={preview}
        keyword={q}
        categoryId={category}
        matchCount={matchCount}
        catalogCount={catalogCount}
        page={page}
        sort={sort}
        inStock={inStock}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      />
    </div>
  );
}
