import { db } from "@/lib/db";
import { decrypt } from "@/lib/bigcommerce/encryption";
import { bc, type BCProduct } from "@/lib/bigcommerce/client";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { wholesaleUnitCost } from "./money";
import { emailAccount } from "./notify";
import { scrubListingText } from "./scrub";
import {
  createProduct,
  deleteProduct,
  downloadAsBase64,
  productExists,
  setInventory,
  ShopifyNotFoundError,
} from "./shopify-admin";

async function discountPercent(account: { lastTier: string; welcomeExpiresAt: Date | null }): Promise<number> {
  const earned = await getTierDiscountPercent(account.lastTier);
  if (!isWelcomeActive(account.welcomeExpiresAt)) return earned;
  const welcome = await loadWelcomeConfig();
  return welcome.enabled && welcome.discount > earned ? welcome.discount : earned;
}

function retailOf(
  product: BCProduct,
  variant?: { calculated_price?: number | null; price?: number | null }
): number {
  return Number(variant?.calculated_price || variant?.price || product.calculated_price || product.price || 0);
}

export async function publishBigCommerceProduct(connectionId: string, bcProductId: number): Promise<"added" | "skipped" | "failed"> {
  const connection = await db.shopifyConnection.findUnique({
    where: { id: connectionId },
    include: { account: true },
  });
  if (!connection || connection.disconnectedAt || !connection.accessTokenEnc) return "failed";
  if (connection.addressTestStatus !== "PASSED") return "failed";
  const product = await bc().getProductById(bcProductId);
  if (!product || !product.is_visible) return "skipped";

  const existing = await db.channelListing.findFirst({
    where: { connectionId, bcProductId, removedAt: null },
  });
  if (existing) return "skipped";

  const token = decrypt(connection.accessTokenEnc);
  const percent = await discountPercent(connection.account);
  const variants = product.variants?.length ? product.variants : [undefined];
  const images = [];
  for (const image of product.images || []) {
    const file = await downloadAsBase64(image.url_standard);
    if (file) images.push(file);
  }
  const title = scrubListingText(product.name) || "Product";
  const created = await createProduct(connection.shopDomain, token, {
    title,
    bodyHtml: scrubListingText(product.description || ""),
    vendor: connection.account.companyName,
    imageAttachments: images,
    options: variants.length > 1 ? ["Option"] : undefined,
    variants: variants.map((variant) => {
      const retail = retailOf(product, variant);
      return {
        price: retail.toFixed(2),
        cost: wholesaleUnitCost(retail, percent).toFixed(2),
        option1: variants.length > 1 ? `Option ${variant?.id || product.id}` : undefined,
      };
    }),
  });

  const locationId = connection.primaryLocationId;
  for (let index = 0; index < created.length; index++) {
    const row = created[index];
    const variant = variants[index];
    const onHand = variant ? variant.inventory_level : product.inventory_level;
    if (locationId) {
      await setInventory(connection.shopDomain, token, locationId, row.inventoryItemId, Math.max(0, onHand));
    }
    await db.channelListing.create({
      data: {
        accountId: connection.accountId,
        connectionId,
        bcProductId: product.id,
        bcVariantId: variant?.id || 0,
        shopifyProductId: row.productId,
        shopifyVariantId: row.variantId,
        shopifyInventoryItemId: row.inventoryItemId,
        sellerPrice: retailOf(product, variant),
        internalSku: variant?.sku || product.sku,
        titleSnapshot: title,
      },
    });
  }
  return "added";
}

const PUBLISH_BATCH = 20;

export async function runNextPublishJob(): Promise<boolean> {
  const job = await db.channelPublishJob.findFirst({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { updatedAt: "asc" },
    include: { connection: true },
  });
  if (!job) return false;
  if (job.connection.shopDomain.startsWith("preview-")) {
    await db.channelPublishJob.update({
      where: { id: job.id },
      data: { status: "FAILED", emailSentAt: new Date() },
    });
    return true;
  }
  const busy = await db.channelPublishJob.findFirst({
    where: { connectionId: job.connectionId, status: "RUNNING", id: { not: job.id } },
  });
  if (busy) return false;
  if (job.connection.disconnectedAt) {
    await db.channelPublishJob.update({
      where: { id: job.id },
      data: { status: "FAILED", emailSentAt: new Date() },
    });
    await emailAccount(
      job.requestedByEmail,
      "Your Shopify listings stopped",
      `Added ${job.addedCount}, skipped ${job.skippedCount}, failed ${job.failedCount}. That store was disconnected, so the rest was not added.`
    );
    return true;
  }

  await db.channelPublishJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });
  const detail = (job.detail || {}) as {
    bcProductIds?: number[];
    keyword?: string;
    categoryId?: number;
    page?: number;
  };
  let ids: number[] = [];
  let finished = false;
  let nextPage = detail.page || 1;
  if (detail.bcProductIds) {
    const all = detail.bcProductIds;
    const start = job.cursor ? all.indexOf(Number(job.cursor)) + 1 : 0;
    ids = all.slice(start, start + PUBLISH_BATCH);
    finished = start + ids.length >= all.length;
  } else {
    const page = detail.page || 1;
    const result = await bc().getProducts({
      is_visible: true,
      keyword: detail.keyword || undefined,
      categoryId: detail.categoryId,
      limit: PUBLISH_BATCH,
      page,
    });
    ids = (result.data || []).map((product) => product.id);
    const totalPages = result.meta?.pagination?.total_pages || page;
    finished = page >= totalPages || ids.length === 0;
    nextPage = page + 1;
  }

  let added = job.addedCount;
  let skipped = job.skippedCount;
  let failed = job.failedCount;
  let cursor = job.cursor;
  for (const productId of ids) {
    try {
      const result = await publishBigCommerceProduct(job.connectionId, productId);
      if (result === "added") added += 1;
      else if (result === "skipped") skipped += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
    cursor = String(productId);
  }
  await db.channelPublishJob.update({
    where: { id: job.id },
    data: {
      addedCount: added,
      skippedCount: skipped,
      failedCount: failed,
      cursor,
      status: finished ? "COMPLETED" : "RUNNING",
      emailSentAt: finished ? new Date() : null,
      detail: { ...detail, page: nextPage },
    },
  });
  if (finished) {
    await emailAccount(
      job.requestedByEmail,
      "Your Shopify listings are finished",
      `Added ${added}, skipped ${skipped}, failed ${failed}.`
    );
  }
  return true;
}

export async function syncListingInventory(limit = 40): Promise<number> {
  const listings = await db.channelListing.findMany({
    where: { removedAt: null, connection: { disconnectedAt: null, addressTestStatus: "PASSED" } },
    include: { connection: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  let updated = 0;
  for (const listing of listings) {
    if (!listing.connection.accessTokenEnc || !listing.shopifyInventoryItemId || !listing.connection.primaryLocationId) {
      continue;
    }
    const token = decrypt(listing.connection.accessTokenEnc);
    try {
      const stillThere = await productExists(listing.connection.shopDomain, token, listing.shopifyProductId);
      if (!stillThere) {
        await db.channelListing.update({ where: { id: listing.id }, data: { removedAt: new Date() } });
        continue;
      }
      const product = await bc().getProductById(listing.bcProductId);
      const variant = listing.bcVariantId
        ? product?.variants?.find((row) => row.id === listing.bcVariantId)
        : undefined;
      const onHand = !product?.is_visible ? 0 : variant ? variant.inventory_level : product?.inventory_level || 0;
      await setInventory(
        listing.connection.shopDomain,
        token,
        listing.connection.primaryLocationId,
        listing.shopifyInventoryItemId,
        Math.max(0, onHand)
      );
      await db.channelListing.update({ where: { id: listing.id }, data: { updatedAt: new Date() } });
      updated += 1;
    } catch (error) {
      if (error instanceof ShopifyNotFoundError) {
        await db.channelListing.update({ where: { id: listing.id }, data: { removedAt: new Date() } });
      }
    }
  }
  return updated;
}

export async function removeListing(listingId: string): Promise<void> {
  const listing = await db.channelListing.findUnique({
    where: { id: listingId },
    include: { connection: true },
  });
  if (!listing || !listing.connection.accessTokenEnc) return;
  const token = decrypt(listing.connection.accessTokenEnc);
  try {
    await deleteProduct(listing.connection.shopDomain, token, listing.shopifyProductId);
  } catch (error) {
    if (!(error instanceof ShopifyNotFoundError)) throw error;
  }
  await db.channelListing.updateMany({
    where: { connectionId: listing.connectionId, shopifyProductId: listing.shopifyProductId },
    data: { removedAt: new Date() },
  });
}
