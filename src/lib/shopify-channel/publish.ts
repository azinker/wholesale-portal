import { db } from "@/lib/db";
import { decrypt } from "@/lib/bigcommerce/encryption";
import { bc, type BCProduct, type BCProductImage } from "@/lib/bigcommerce/client";
import { getTierDiscountPercent, isWelcomeActive, loadWelcomeConfig } from "@/lib/tier-engine";
import { roundMoney, wholesaleUnitCost } from "./money";
import { emailAccount } from "./notify";
import { scrubListingText } from "./scrub";
import {
  addProductImage,
  assignVariantImage,
  createProduct,
  deleteProduct,
  deleteProductImage,
  downloadAsBase64,
  productExists,
  readProduct,
  setImagePosition,
  setInventory,
  ShopifyNotFoundError,
} from "./shopify-admin";

export type ListingVariantReceipt = {
  label: string;
  retail: number;
  cost: number;
  stock: number;
  imageUrl: string | null;
};

export type ListingReceipt = {
  status: "added" | "skipped" | "failed";
  title: string;
  imageUrl: string | null;
  shopDomain: string;
  shopifyProductId: string | null;
  storeUrl: string | null;
  adminUrl: string | null;
  retail: number;
  cost: number;
  margin: number;
  stock: number;
  variants: ListingVariantReceipt[];
  message: string;
};

type BcVariant = NonNullable<BCProduct["variants"]>[number];

function fileKey(url: string): string {
  let name = "";
  try {
    name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  } catch {
    name = url.split("?")[0].split("/").pop() || "";
  }
  name = name.toLowerCase().replace(/\.[a-z0-9]{2,5}$/, "").replace(/\.__\d+$/, "");
  return name.replace(/[^a-z0-9]+/g, "");
}

function uploadName(url: string, index: number): string {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = (match?.[1] || "jpg").toLowerCase();
  return `${fileKey(url) || `photo-${index + 1}`}.${ext}`;
}

function imagesInEditorOrder(images: BCProductImage[]): BCProductImage[] {
  return [...images].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

function variantChoices(variants: BcVariant[]): { names: string[]; rows: string[][] } {
  if (variants.length <= 1) return { names: [], rows: variants.map(() => []) };
  const names: string[] = [];
  for (const variant of variants) {
    for (const value of variant.option_values || []) {
      const name = value.option_display_name?.trim();
      if (name && !names.includes(name) && names.length < 3) names.push(name);
    }
  }
  if (names.length === 0) names.push("Style");
  const rows = variants.map((variant, index) =>
    names.map((name) => {
      const found = variant.option_values?.find((value) => value.option_display_name === name);
      return found?.label?.trim() || `Choice ${index + 1}`;
    })
  );
  return { names, rows };
}

function variantLabel(names: string[], row: string[]): string {
  if (row.length === 0) return "Default";
  return row.map((value, index) => (names[index] ? `${names[index]}: ${value}` : value)).join(", ");
}

function storeUrls(shopDomain: string, productId: string | null, handle: string | null) {
  return {
    storeUrl: handle ? `https://${shopDomain}/products/${handle}` : null,
    adminUrl: productId ? `https://${shopDomain}/admin/products/${productId}` : null,
  };
}

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

export type PushVariant = {
  bcVariantId: number;
  price?: number;
  sku?: string;
};

export type PushChoices = {
  priceMode?: "retail" | "markup" | "custom";
  markupPercent?: number;
  customPrice?: number;
  sellerSku?: string;
  compareAt?: number;
  productType?: string;
  variants?: PushVariant[];
};

export function cleanPush(raw: unknown): PushChoices {
  if (!raw || typeof raw !== "object") return { priceMode: "retail" };
  const body = raw as Record<string, unknown>;
  const priceMode = body.priceMode === "markup" || body.priceMode === "custom" ? body.priceMode : "retail";
  const markup = Number(body.markupPercent);
  const custom = Number(body.customPrice);
  const compare = Number(body.compareAt);
  const sellerSku = typeof body.sellerSku === "string" ? body.sellerSku.replace(/[\r\n]/g, " ").trim().slice(0, 64) : "";
  const productType = typeof body.productType === "string" ? body.productType.replace(/[\r\n]/g, " ").trim().slice(0, 80) : "";
  const variants = Array.isArray(body.variants)
    ? body.variants.slice(0, 80).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = Number(row.bcVariantId);
        if (!Number.isInteger(id) || id <= 0) return [];
        const price = Number(row.price);
        const sku = typeof row.sku === "string" ? row.sku.replace(/[\r\n]/g, " ").trim().slice(0, 64) : "";
        return [{
          bcVariantId: id,
          price: Number.isFinite(price) && price >= 0.01 && price <= 100000 ? roundMoney(price) : undefined,
          sku: sku || undefined,
        }];
      })
    : [];
  return {
    priceMode,
    markupPercent: priceMode === "markup" && Number.isFinite(markup) && markup >= 0 && markup <= 500 ? markup : undefined,
    customPrice: priceMode === "custom" && Number.isFinite(custom) && custom >= 0.01 && custom <= 100000 ? roundMoney(custom) : undefined,
    sellerSku: sellerSku || undefined,
    compareAt: Number.isFinite(compare) && compare >= 0.01 && compare <= 100000 ? roundMoney(compare) : undefined,
    productType: productType || undefined,
    variants: variants.length ? variants : undefined,
  };
}

function listPrice(retail: number, cost: number, choices: PushChoices, variantId?: number): number {
  const row = variantId ? choices.variants?.find((item) => item.bcVariantId === variantId) : undefined;
  if (row?.price) return Math.max(0.01, row.price);
  if (choices.priceMode === "custom" && choices.customPrice) return choices.customPrice;
  if (choices.priceMode === "markup" && choices.markupPercent != null) {
    return Math.max(0.01, roundMoney(cost * (1 + choices.markupPercent / 100)));
  }
  return Math.max(0.01, roundMoney(retail));
}

function sellerSkuFor(choices: PushChoices, variantId: number | undefined, index: number, count: number): string | undefined {
  if (choices.variants?.length) {
    const row = variantId ? choices.variants.find((item) => item.bcVariantId === variantId) : undefined;
    return row?.sku;
  }
  if (!choices.sellerSku) return undefined;
  if (count <= 1) return choices.sellerSku;
  return `${choices.sellerSku}-${index + 1}`.slice(0, 64);
}

function emptyReceipt(shopDomain: string, status: ListingReceipt["status"], message: string, title = "Product"): ListingReceipt {
  return {
    status,
    title,
    imageUrl: null,
    shopDomain,
    shopifyProductId: null,
    storeUrl: null,
    adminUrl: null,
    retail: 0,
    cost: 0,
    margin: 0,
    stock: 0,
    variants: [],
    message,
  };
}

export function plainAddError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/unique constraint/i.test(message)) {
    return "This product is already on your Shopify store. Remove it in the catalog if you want to add it again.";
  }
  if (/shopify/i.test(message) && /fail|not accept|denied/i.test(message)) {
    return "Shopify did not accept this product. Wait a minute and try again.";
  }
  if (/timeout|timed out|fetch failed|ECONN|aborted/i.test(message)) {
    return "Shopify took too long to answer. Wait a minute and try again.";
  }
  return "This product could not be added. Wait a minute and try again.";
}

export type AddProgress = { done: number; total: number; label: string; startedAt: number };

async function uploadImagesInOrder(
  shop: string,
  token: string,
  productId: string,
  images: BCProductImage[],
  onImage?: (index: number, count: number) => Promise<void>
): Promise<Array<{ bcImageId: number; shopifyImageId: string; key: string }>> {
  const uploaded: Array<{ bcImageId: number; shopifyImageId: string; key: string }> = [];
  for (let index = 0; index < images.length; index++) {
    await onImage?.(index, images.length);
    const image = images[index];
    const file = await downloadAsBase64(image.url_standard || image.url_zoom || "");
    if (!file) continue;
    const created = await addProductImage(shop, token, productId, {
      attachment: file,
      filename: uploadName(image.url_standard || image.url_zoom || "", index),
      position: uploaded.length + 1,
    });
    uploaded.push({
      bcImageId: image.id,
      shopifyImageId: created.id,
      key: fileKey(image.url_standard || image.url_zoom || ""),
    });
  }
  if (uploaded[0]) {
    await setImagePosition(shop, token, productId, uploaded[0].shopifyImageId, 1);
  }
  return uploaded;
}

function shopifyImageForVariant(
  variant: BcVariant | undefined,
  uploaded: Array<{ bcImageId: number; shopifyImageId: string; key: string }>,
  gallery: BCProductImage[]
): string | null {
  const source = variant?.image_url;
  if (!source) return null;
  const key = fileKey(source);
  const match = uploaded.find((image) => image.key && image.key === key);
  if (match) return match.shopifyImageId;
  const galleryMatch = gallery.find((image) => fileKey(image.url_standard || "") === key || fileKey(image.url_zoom || "") === key);
  if (!galleryMatch) return null;
  return uploaded.find((image) => image.bcImageId === galleryMatch.id)?.shopifyImageId || null;
}

const alignedOnce = new Set<string>();

export async function alignListingImages(connectionId: string, bcProductId: number): Promise<void> {
  const mark = `${connectionId}:${bcProductId}`;
  if (alignedOnce.has(mark)) return;
  const connection = await db.shopifyConnection.findUnique({ where: { id: connectionId } });
  if (!connection?.accessTokenEnc || connection.disconnectedAt) return;
  const listing = await db.channelListing.findFirst({
    where: { connectionId, bcProductId, removedAt: null },
  });
  if (!listing) return;
  const product = await bc().getProductById(bcProductId);
  if (!product) return;
  const ordered = imagesInEditorOrder(product.images || []);
  if (ordered.length === 0) return;
  const token = decrypt(connection.accessTokenEnc);
  const live = await readProduct(connection.shopDomain, token, listing.shopifyProductId);
  if (!live) return;
  const mainKey = fileKey(ordered[0].url_standard || ordered[0].url_zoom || "");
  const current = [...live.images].sort((a, b) => a.position - b.position);
  if (current[0] && mainKey && fileKey(current[0].src) === mainKey) {
    alignedOnce.add(mark);
    return;
  }
  const uploaded = await uploadImagesInOrder(connection.shopDomain, token, listing.shopifyProductId, ordered);
  if (uploaded.length === 0) return;
  for (const image of current) {
    try {
      await deleteProductImage(connection.shopDomain, token, listing.shopifyProductId, image.id);
    } catch (error) {
      if (!(error instanceof ShopifyNotFoundError)) throw error;
    }
  }
  await setImagePosition(connection.shopDomain, token, listing.shopifyProductId, uploaded[0].shopifyImageId, 1);
  const listings = await db.channelListing.findMany({
    where: { connectionId, bcProductId, removedAt: null },
  });
  const variants = product.variants || [];
  for (const row of listings) {
    const variant = variants.find((item) => item.id === row.bcVariantId);
    const imageId = shopifyImageForVariant(variant, uploaded, ordered);
    if (!imageId) continue;
    await assignVariantImage(connection.shopDomain, token, listing.shopifyProductId, row.shopifyVariantId, imageId);
  }
  alignedOnce.add(mark);
}

export async function publishBigCommerceProduct(
  connectionId: string,
  bcProductId: number,
  choices: PushChoices = {},
  onProgress?: (done: number, total: number, label: string) => Promise<void>
): Promise<ListingReceipt> {
  const connection = await db.shopifyConnection.findUnique({
    where: { id: connectionId },
    include: { account: true },
  });
  if (!connection || connection.disconnectedAt || !connection.accessTokenEnc) {
    return emptyReceipt("", "failed", "That store is not connected.");
  }
  if (connection.addressTestStatus !== "PASSED") {
    return emptyReceipt(connection.shopDomain, "failed", "This store has not passed the address test.");
  }
  const product = await bc().getProductById(bcProductId);
  const title = scrubListingText(product?.name || "") || "Product";
  if (!product || !product.is_visible) {
    return emptyReceipt(connection.shopDomain, "skipped", "This product is not available to add.", title);
  }

  const existing = await db.channelListing.findFirst({
    where: { connectionId, bcProductId, removedAt: null },
  });
  if (existing) {
    await alignListingImages(connectionId, bcProductId).catch(() => undefined);
    return receiptForExisting(connection.shopDomain, connection.accessTokenEnc, product, existing.shopifyProductId, connection.account);
  }

  const token = decrypt(connection.accessTokenEnc);
  const percent = await discountPercent(connection.account);
  const sourceVariants = product.variants?.length ? product.variants : [];
  const rows = sourceVariants.length ? sourceVariants : [undefined];
  const options = variantChoices(sourceVariants);
  const orderedImages = imagesInEditorOrder(product.images || []);
  const created = await createProduct(connection.shopDomain, token, {
    title,
    bodyHtml: scrubListingText(product.description || ""),
    vendor: connection.account.companyName,
    productType: choices.productType,
    options: options.names,
    variants: rows.map((variant, index) => {
      const retail = retailOf(product, variant);
      const cost = wholesaleUnitCost(retail, percent);
      const list = listPrice(retail, cost, choices, variant?.id);
      const sku = sellerSkuFor(choices, variant?.id, index, rows.length);
      const compare = choices.compareAt && choices.compareAt > list ? choices.compareAt.toFixed(2) : undefined;
      const choice = options.rows[index] || [];
      return {
        price: list.toFixed(2),
        cost: cost.toFixed(2),
        sku,
        compareAt: compare,
        option1: choice[0],
        option2: choice[1],
        option3: choice[2],
      };
    }),
  });

  const uploaded = await uploadImagesInOrder(connection.shopDomain, token, created.productId, orderedImages);
  const locationId = connection.primaryLocationId;
  const variantReceipts: ListingVariantReceipt[] = [];
  for (let index = 0; index < created.variants.length; index++) {
    const row = created.variants[index];
    const variant = rows[index];
    const retail = retailOf(product, variant);
    const cost = wholesaleUnitCost(retail, percent);
    const onHand = variant ? variant.inventory_level : product.inventory_level;
    if (locationId) {
      await setInventory(connection.shopDomain, token, locationId, row.inventoryItemId, Math.max(0, onHand));
    }
    let imageId = shopifyImageForVariant(variant, uploaded, orderedImages);
    if (!imageId && variant?.image_url) {
      const file = await downloadAsBase64(variant.image_url);
      if (file) {
        const extra = await addProductImage(connection.shopDomain, token, created.productId, {
          attachment: file,
          filename: uploadName(variant.image_url, uploaded.length),
          position: uploaded.length + 1,
        });
        imageId = extra.id;
        uploaded.push({ bcImageId: 0, shopifyImageId: extra.id, key: fileKey(variant.image_url) });
      }
    }
    if (imageId) {
      await assignVariantImage(connection.shopDomain, token, created.productId, row.variantId, imageId);
    }
    if (sourceVariants.length > 1 && variant) {
      const listed = listPrice(retail, cost, choices, variant.id);
      variantReceipts.push({
        label: variantLabel(options.names, options.rows[index] || []),
        retail: listed,
        cost,
        stock: Math.max(0, onHand),
        imageUrl: variant.image_url || null,
      });
    }
    if (uploaded[0]) {
      await setImagePosition(connection.shopDomain, token, created.productId, uploaded[0].shopifyImageId, 1);
    }
    await db.channelListing.upsert({
      where: {
        connectionId_bcProductId_bcVariantId: {
          connectionId,
          bcProductId: product.id,
          bcVariantId: variant?.id || 0,
        },
      },
      create: {
        accountId: connection.accountId,
        connectionId,
        bcProductId: product.id,
        bcVariantId: variant?.id || 0,
        shopifyProductId: created.productId,
        shopifyVariantId: row.variantId,
        shopifyInventoryItemId: row.inventoryItemId,
        sellerPrice: listPrice(retail, cost, choices, variant?.id),
        sellerSku: sellerSkuFor(choices, variant?.id, index, rows.length) || null,
        internalSku: variant?.sku || product.sku,
        titleSnapshot: title,
      },
      update: {
        removedAt: null,
        shopifyProductId: created.productId,
        shopifyVariantId: row.variantId,
        shopifyInventoryItemId: row.inventoryItemId,
        sellerPrice: listPrice(retail, cost, choices, variant?.id),
        sellerSku: sellerSkuFor(choices, variant?.id, index, rows.length) || null,
        titleSnapshot: title,
      },
    });
  }

  const catalogRetail = retailOf(product, sourceVariants.length === 1 ? sourceVariants[0] : undefined);
  const cost = wholesaleUnitCost(catalogRetail, percent);
  const listed = listPrice(catalogRetail, cost, choices, sourceVariants.length === 1 ? sourceVariants[0]?.id : undefined);
  const stock = sourceVariants.length > 1
    ? sourceVariants.reduce((sum, variant) => sum + Math.max(0, variant.inventory_level), 0)
    : Math.max(0, product.inventory_level);
  const links = storeUrls(connection.shopDomain, created.productId, created.handle);
  const mainImage = orderedImages[0]?.url_standard || null;
  return {
    status: "added",
    title,
    imageUrl: mainImage,
    shopDomain: connection.shopDomain,
    shopifyProductId: created.productId,
    storeUrl: links.storeUrl,
    adminUrl: links.adminUrl,
    retail: listed,
    cost,
    margin: roundMoney(listed - cost),
    stock,
    variants: variantReceipts,
    message: `${title} is on ${connection.shopDomain}.`,
  };
}

async function receiptForExisting(
  shopDomain: string,
  tokenEnc: string,
  product: BCProduct,
  shopifyProductId: string,
  account: { lastTier: string; welcomeExpiresAt: Date | null }
): Promise<ListingReceipt> {
  const percent = await discountPercent(account);
  const token = decrypt(tokenEnc);
  const live = await readProduct(shopDomain, token, shopifyProductId).catch(() => null);
  const ordered = imagesInEditorOrder(product.images || []);
  const sourceVariants = product.variants || [];
  const choices = variantChoices(sourceVariants);
  const catalogRetail = retailOf(product, sourceVariants.length === 1 ? sourceVariants[0] : undefined);
  const cost = wholesaleUnitCost(catalogRetail, percent);
  const livePrice = Number(live?.variants?.[0]?.price || 0);
  const retail = livePrice > 0 ? livePrice : catalogRetail;
  const stock = sourceVariants.length > 1
    ? sourceVariants.reduce((sum, variant) => sum + Math.max(0, variant.inventory_level), 0)
    : Math.max(0, product.inventory_level);
  const links = storeUrls(shopDomain, shopifyProductId, live?.handle || null);
  const title = scrubListingText(live?.title || product.name) || "Product";
  return {
    status: "skipped",
    title,
    imageUrl: live?.images.slice().sort((a, b) => a.position - b.position)[0]?.src || ordered[0]?.url_standard || null,
    shopDomain,
    shopifyProductId,
    storeUrl: links.storeUrl,
    adminUrl: links.adminUrl,
    retail,
    cost,
    margin: roundMoney(retail - cost),
    stock,
    variants: sourceVariants.length > 1
      ? sourceVariants.map((variant, index) => {
          const catalog = retailOf(product, variant);
          const liveVariant = Number(live?.variants?.[index]?.price || 0);
          const listed = liveVariant > 0 ? liveVariant : catalog;
          return {
            label: variantLabel(choices.names, choices.rows[index] || []),
            retail: listed,
            cost: wholesaleUnitCost(catalog, percent),
            stock: Math.max(0, variant.inventory_level),
            imageUrl: variant.image_url || null,
          };
        })
      : [],
    message: `${title} is already on ${shopDomain}.`,
  };
}

export async function listingDetails(accountId: string, bcProductId: number): Promise<ListingReceipt[]> {
  const product = await bc().getProductById(bcProductId);
  if (!product) return [];
  const rows = await db.channelListing.findMany({
    where: { accountId, bcProductId, removedAt: null, connection: { disconnectedAt: null } },
    include: { connection: true, account: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const receipts: ListingReceipt[] = [];
  for (const row of rows) {
    if (seen.has(row.connectionId) || !row.connection.accessTokenEnc) continue;
    seen.add(row.connectionId);
    await alignListingImages(row.connectionId, bcProductId).catch(() => undefined);
    receipts.push(
      await receiptForExisting(
        row.connection.shopDomain,
        row.connection.accessTokenEnc,
        product,
        row.shopifyProductId,
        row.account
      )
    );
  }
  return receipts;
}

const PUBLISH_BATCH = 20;

export async function runNextPublishJob(jobId?: string): Promise<boolean> {
  const job = jobId
    ? await db.channelPublishJob.findFirst({
        where: { id: jobId, status: { in: ["QUEUED", "RUNNING"] } },
        include: { connection: true },
      })
    : await db.channelPublishJob.findFirst({
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
    push?: PushChoices;
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
  const push = cleanPush(detail.push);
  if ((detail.bcProductIds?.length || 0) !== 1) {
    delete push.sellerSku;
    delete push.compareAt;
  }
  for (const productId of ids) {
    try {
      const result = await publishBigCommerceProduct(job.connectionId, productId, push);
      if (result.status === "added") added += 1;
      else if (result.status === "skipped") skipped += 1;
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
