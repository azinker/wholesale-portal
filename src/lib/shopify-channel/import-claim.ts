import { bc } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";
import { liveShopifyToken } from "./token";
import { listStoreSkus, type StoreSkuRow } from "./shopify-admin";

const SCAN_AGAIN_MS = 10 * 60 * 1000;

export type CatalogSkuRow = {
  sku: string;
  bcProductId: number;
  bcVariantId: number;
};

export type ImportClaim = {
  sku: string;
  bcProductId: number;
  bcVariantId: number;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyInventoryItemId: string;
  title: string;
  sellerPrice: number;
};

export type ImportClaimChoice = {
  claims: ImportClaim[];
  skippedDuplicate: number;
  skippedAlready: number;
  partialProducts: number;
};

function skuKey(sku: string): string {
  return sku.trim().toLowerCase();
}

export function claimTitle(productTitle: string, variantTitle: string): string {
  const product = productTitle.trim() || "Product";
  const variant = variantTitle.trim();
  if (!variant || variant.toLowerCase() === "default title") return product;
  return `${product} — ${variant}`;
}

function claimPrice(value: string): number {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) return 0;
  return Math.round(price * 100) / 100;
}

/** Match store variants to our catalog by product code. One code must point at one product on each side. */
export function chooseImportedClaims(input: {
  store: StoreSkuRow[];
  catalog: CatalogSkuRow[];
  ownedVariantIds: string[];
  ownedBcKeys: string[];
  leftSkus: string[];
}): ImportClaimChoice {
  const catalogByKey = new Map<string, CatalogSkuRow[]>();
  for (const row of input.catalog) {
    const key = skuKey(row.sku);
    if (!key) continue;
    catalogByKey.set(key, [...(catalogByKey.get(key) || []), row]);
  }
  const storeByKey = new Map<string, StoreSkuRow[]>();
  const variantsOnProduct = new Map<string, number>();
  for (const row of input.store) {
    variantsOnProduct.set(row.productId, (variantsOnProduct.get(row.productId) || 0) + 1);
    const key = skuKey(row.sku);
    if (!key) continue;
    storeByKey.set(key, [...(storeByKey.get(key) || []), row]);
  }
  const left = new Set(input.leftSkus.map(skuKey));
  const ownedVariants = new Set(input.ownedVariantIds);
  const ownedBc = new Set(input.ownedBcKeys);
  const claims: ImportClaim[] = [];
  let skippedDuplicate = 0;
  let skippedAlready = 0;

  for (const [key, storeRows] of storeByKey) {
    const catalogRows = catalogByKey.get(key) || [];
    if (catalogRows.length === 0) continue;
    if (storeRows.length !== 1 || catalogRows.length !== 1) {
      skippedDuplicate += 1;
      continue;
    }
    if (left.has(key)) continue;
    const storeRow = storeRows[0];
    const catalogRow = catalogRows[0];
    const bcKey = `${catalogRow.bcProductId}:${catalogRow.bcVariantId}`;
    if (ownedVariants.has(storeRow.variantId) || ownedBc.has(bcKey)) {
      skippedAlready += 1;
      continue;
    }
    if (!storeRow.inventoryItemId) continue;
    claims.push({
      sku: catalogRow.sku.trim(),
      bcProductId: catalogRow.bcProductId,
      bcVariantId: catalogRow.bcVariantId,
      shopifyProductId: storeRow.productId,
      shopifyVariantId: storeRow.variantId,
      shopifyInventoryItemId: storeRow.inventoryItemId,
      title: claimTitle(storeRow.productTitle, storeRow.variantTitle).slice(0, 300),
      sellerPrice: claimPrice(storeRow.price),
    });
  }

  claims.sort((a, b) => a.title.localeCompare(b.title) || a.sku.localeCompare(b.sku));
  const claimedOnProduct = new Map<string, number>();
  for (const claim of claims) {
    claimedOnProduct.set(claim.shopifyProductId, (claimedOnProduct.get(claim.shopifyProductId) || 0) + 1);
  }
  let partialProducts = 0;
  for (const [productId, claimed] of claimedOnProduct) {
    if ((variantsOnProduct.get(productId) || 0) > claimed) partialProducts += 1;
  }
  return { claims, skippedDuplicate, skippedAlready, partialProducts };
}

export type ImportOfferView = {
  title: string;
  sku: string;
  price: number;
};

export type ImportClaimView = {
  offers: ImportOfferView[];
  leftCount: number;
  skippedDuplicate: number;
  skippedAlready: number;
  partialProducts: number;
  checkedAll: boolean;
};

function offerView(row: { title: string; sku: string; sellerPrice: { toString(): string } | number }): ImportOfferView {
  return { title: row.title, sku: row.sku, price: Number(row.sellerPrice) };
}

async function loadConnection(connectionId: string, accountId: string) {
  const connection = await db.shopifyConnection.findFirst({
    where: { id: connectionId, accountId, disconnectedAt: null },
  });
  if (!connection?.accessTokenEnc) return null;
  return connection;
}

export async function importClaimView(connectionId: string, accountId: string, fresh: boolean): Promise<ImportClaimView | null> {
  const connection = await loadConnection(connectionId, accountId);
  if (!connection) return null;
  const scan = await db.channelImportScan.findUnique({ where: { connectionId } });
  const recent = scan && Date.now() - scan.scannedAt.getTime() < SCAN_AGAIN_MS;
  if (!fresh && recent) {
    const [open, leftCount] = await Promise.all([
      db.channelImportOffer.findMany({ where: { connectionId, status: "OPEN" }, orderBy: { title: "asc" } }),
      db.channelImportOffer.count({ where: { connectionId, status: "LEFT" } }),
    ]);
    return { offers: open.map(offerView), leftCount, skippedDuplicate: 0, skippedAlready: 0, partialProducts: 0, checkedAll: true };
  }
  const token = await liveShopifyToken(connection);
  if (!token) return null;
  const { rows, checkedAll } = await listStoreSkus(connection.shopDomain, token);
  const catalog = await bc().getCatalogBySkus(rows.map((row) => row.sku).filter(Boolean));
  const [listings, leftOffers] = await Promise.all([
    db.channelListing.findMany({
      where: { connectionId, removedAt: null },
      select: { shopifyVariantId: true, bcProductId: true, bcVariantId: true },
    }),
    db.channelImportOffer.findMany({ where: { connectionId, status: "LEFT" }, select: { id: true, sku: true } }),
  ]);
  const choice = chooseImportedClaims({
    store: rows,
    catalog,
    ownedVariantIds: listings.map((row) => row.shopifyVariantId),
    ownedBcKeys: listings.map((row) => `${row.bcProductId}:${row.bcVariantId}`),
    leftSkus: leftOffers.map((row) => row.sku),
  });
  const liveSkus = new Set(rows.map((row) => skuKey(row.sku)).filter(Boolean));
  const staleLeft = leftOffers.filter((row) => !liveSkus.has(skuKey(row.sku))).map((row) => row.id);
  await db.channelImportOffer.deleteMany({
    where: staleLeft.length
      ? { connectionId, OR: [{ status: "OPEN" }, { id: { in: staleLeft } }] }
      : { connectionId, status: "OPEN" },
  });
  if (choice.claims.length) {
    await db.channelImportOffer.deleteMany({
      where: { connectionId, shopifyVariantId: { in: choice.claims.map((claim) => claim.shopifyVariantId) } },
    });
    await db.channelImportOffer.createMany({
      data: choice.claims.map((claim) => ({
        connectionId,
        sku: claim.sku,
        bcProductId: claim.bcProductId,
        bcVariantId: claim.bcVariantId,
        shopifyProductId: claim.shopifyProductId,
        shopifyVariantId: claim.shopifyVariantId,
        shopifyInventoryItemId: claim.shopifyInventoryItemId,
        title: claim.title,
        sellerPrice: claim.sellerPrice,
        status: "OPEN",
      })),
    });
  }
  await db.channelImportScan.upsert({
    where: { connectionId },
    create: { connectionId, scannedAt: new Date() },
    update: { scannedAt: new Date() },
  });
  const leftCount = await db.channelImportOffer.count({ where: { connectionId, status: "LEFT" } });
  return {
    offers: choice.claims.map((claim) => ({ title: claim.title, sku: claim.sku, price: claim.sellerPrice })),
    leftCount,
    skippedDuplicate: choice.skippedDuplicate,
    skippedAlready: choice.skippedAlready,
    partialProducts: choice.partialProducts,
    checkedAll,
  };
}

export async function reopenImportClaims(connectionId: string, accountId: string): Promise<ImportClaimView | null> {
  const connection = await loadConnection(connectionId, accountId);
  if (!connection) return null;
  await db.channelImportOffer.deleteMany({ where: { connectionId, status: "LEFT" } });
  await db.channelImportScan.deleteMany({ where: { connectionId } });
  return importClaimView(connectionId, accountId, true);
}

export async function decideImportClaims(
  connectionId: string,
  accountId: string,
  decision: "yes" | "no"
): Promise<{ count: number } | null> {
  const connection = await loadConnection(connectionId, accountId);
  if (!connection) return null;
  const offers = await db.channelImportOffer.findMany({ where: { connectionId, status: "OPEN" } });
  if (decision === "no") {
    if (offers.length) {
      await db.channelImportOffer.updateMany({ where: { connectionId, status: "OPEN" }, data: { status: "LEFT" } });
    }
    return { count: offers.length };
  }
  let count = 0;
  for (const offer of offers) {
    const owned = await db.channelListing.findFirst({
      where: { connectionId, bcProductId: offer.bcProductId, bcVariantId: offer.bcVariantId, removedAt: null },
    });
    if (owned) continue;
    await db.channelListing.create({
      data: {
        accountId,
        connectionId,
        bcProductId: offer.bcProductId,
        bcVariantId: offer.bcVariantId,
        shopifyProductId: offer.shopifyProductId,
        shopifyVariantId: offer.shopifyVariantId,
        shopifyInventoryItemId: offer.shopifyInventoryItemId,
        sellerPrice: offer.sellerPrice,
        sellerSku: offer.sku,
        internalSku: offer.sku,
        titleSnapshot: offer.title,
      },
    });
    count += 1;
  }
  await db.channelImportOffer.deleteMany({ where: { connectionId, status: "OPEN" } });
  return { count };
}
