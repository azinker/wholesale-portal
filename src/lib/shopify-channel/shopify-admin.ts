import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { SHOPIFY_API_VERSION, SHOPIFY_OAUTH_SCOPES } from "./constants";

export function shopifyAppConfigured(): boolean {
  const e = env();
  return Boolean(e.SHOPIFY_CHANNEL_CLIENT_ID && e.SHOPIFY_CHANNEL_CLIENT_SECRET);
}

export function normalizeShopDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  return domain;
}

export function newWebhookToken(): string {
  return randomBytes(24).toString("hex");
}

export function signOauthState(accountId: string, shop: string): string {
  const payload = `${accountId}|${shop}|${Date.now()}`;
  const sig = createHmac("sha256", env().JWT_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function readOauthState(state: string): { accountId: string; shop: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [accountId, shop, stamp, sig] = parts;
    const payload = `${accountId}|${shop}|${stamp}`;
    const expected = createHmac("sha256", env().JWT_SECRET).update(payload).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(stamp) > 15 * 60 * 1000) return null;
    return { accountId, shop };
  } catch {
    return null;
  }
}

export function oauthStartUrl(shop: string, state: string): string {
  const e = env();
  const redirect = `${e.NEXT_PUBLIC_APP_URL}/api/shopify/channel/callback`;
  const params = new URLSearchParams({
    client_id: e.SHOPIFY_CHANNEL_CLIENT_ID || "",
    scope: SHOPIFY_OAUTH_SCOPES,
    redirect_uri: redirect,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyOauthHmac(query: URLSearchParams): boolean {
  const secret = env().SHOPIFY_CHANNEL_CLIENT_SECRET;
  if (!secret) return false;
  const hmac = query.get("hmac") || "";
  const pairs: string[] = [];
  query.forEach((value, key) => {
    if (key !== "hmac" && key !== "signature") pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const digest = createHmac("sha256", secret).update(pairs.join("&")).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function exchangeOauthCode(shop: string, code: string): Promise<string> {
  const e = env();
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: e.SHOPIFY_CHANNEL_CLIENT_ID,
      client_secret: e.SHOPIFY_CHANNEL_CLIENT_SECRET,
      code,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error || "Shopify did not return an access token");
  }
  return json.access_token;
}

async function shopify<T>(shop: string, token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (res.status === 404) {
    throw new ShopifyNotFoundError(path);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Shopify ${path} failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return json as T;
}

export class ShopifyNotFoundError extends Error {
  constructor(path: string) {
    super(`Shopify resource not found: ${path}`);
  }
}

export async function readShopCurrency(shop: string, token: string): Promise<string> {
  const json = await shopify<{ shop: { currency: string } }>(shop, token, "shop.json");
  return json.shop.currency;
}

export async function readPrimaryLocationId(shop: string, token: string): Promise<string | null> {
  const json = await shopify<{ locations: Array<{ id: number; active: boolean }> }>(
    shop,
    token,
    "locations.json"
  );
  const active = json.locations.find((location) => location.active) || json.locations[0];
  return active ? String(active.id) : null;
}

export type ShopifyCreatedProduct = {
  productId: string;
  handle: string;
  variants: Array<{ variantId: string; inventoryItemId: string }>;
};

export async function createProduct(
  shop: string,
  token: string,
  product: {
    title: string;
    bodyHtml: string;
    vendor: string;
    options?: string[];
    productType?: string;
    variants: Array<{
      price: string;
      cost: string;
      sku?: string;
      compareAt?: string;
      option1?: string;
      option2?: string;
      option3?: string;
    }>;
  }
): Promise<ShopifyCreatedProduct> {
  const body = {
    product: {
      title: product.title,
      body_html: product.bodyHtml,
      vendor: product.vendor,
      product_type: product.productType || undefined,
      status: "active",
      options: product.options?.length ? product.options.map((name) => ({ name })) : undefined,
      variants: product.variants.map((variant) => {
        const row: Record<string, unknown> = {
          price: variant.price,
          inventory_management: "shopify",
          inventory_policy: "deny",
        };
        if (variant.sku) row.sku = variant.sku;
        if (variant.compareAt) row.compare_at_price = variant.compareAt;
        if (variant.option1) row.option1 = variant.option1;
        if (variant.option2) row.option2 = variant.option2;
        if (variant.option3) row.option3 = variant.option3;
        return row;
      }),
    },
  };
  const json = await shopify<{
    product: {
      id: number;
      handle: string;
      variants: Array<{ id: number; inventory_item_id: number }>;
    };
  }>(shop, token, "products.json", { method: "POST", body: JSON.stringify(body) });
  for (let index = 0; index < json.product.variants.length; index++) {
    const variant = json.product.variants[index];
    const cost = product.variants[index]?.cost;
    if (cost) {
      await shopify(shop, token, `inventory_items/${variant.inventory_item_id}.json`, {
        method: "PUT",
        body: JSON.stringify({ inventory_item: { id: variant.inventory_item_id, cost } }),
      });
    }
  }
  return {
    productId: String(json.product.id),
    handle: json.product.handle,
    variants: json.product.variants.map((variant) => ({
      variantId: String(variant.id),
      inventoryItemId: String(variant.inventory_item_id),
    })),
  };
}

export type ShopifyImageRecord = { id: string; position: number; src: string };

export async function addProductImage(
  shop: string,
  token: string,
  productId: string,
  image: { attachment: string; filename: string; position: number }
): Promise<ShopifyImageRecord> {
  const json = await shopify<{ image: { id: number; position: number; src: string } }>(
    shop,
    token,
    `products/${productId}/images.json`,
    {
      method: "POST",
      body: JSON.stringify({
        image: {
          attachment: image.attachment,
          filename: image.filename,
          position: image.position,
        },
      }),
    }
  );
  return { id: String(json.image.id), position: json.image.position, src: json.image.src };
}

export async function setImagePosition(
  shop: string,
  token: string,
  productId: string,
  imageId: string,
  position: number
): Promise<void> {
  await shopify(shop, token, `products/${productId}/images/${imageId}.json`, {
    method: "PUT",
    body: JSON.stringify({ image: { id: Number(imageId), position } }),
  });
}

export async function deleteProductImage(shop: string, token: string, productId: string, imageId: string): Promise<void> {
  await shopify(shop, token, `products/${productId}/images/${imageId}.json`, { method: "DELETE" });
}

export async function assignVariantImage(
  shop: string,
  token: string,
  productId: string,
  variantId: string,
  imageId: string
): Promise<void> {
  await shopify(shop, token, `products/${productId}/variants/${variantId}.json`, {
    method: "PUT",
    body: JSON.stringify({ variant: { id: Number(variantId), image_id: Number(imageId) } }),
  });
}

export async function readProduct(
  shop: string,
  token: string,
  productId: string
): Promise<{
  id: string;
  title: string;
  handle: string;
  images: ShopifyImageRecord[];
  variants: Array<{ id: string; title: string; price: string; imageId: string | null; inventoryItemId: string }>;
} | null> {
  try {
    const json = await shopify<{
      product: {
        id: number;
        title: string;
        handle: string;
        images?: Array<{ id: number; position: number; src: string }>;
        variants: Array<{ id: number; title: string; price: string; image_id: number | null; inventory_item_id: number }>;
      };
    }>(shop, token, `products/${productId}.json`);
    return {
      id: String(json.product.id),
      title: json.product.title,
      handle: json.product.handle,
      images: (json.product.images || []).map((image) => ({
        id: String(image.id),
        position: image.position,
        src: image.src,
      })),
      variants: json.product.variants.map((variant) => ({
        id: String(variant.id),
        title: variant.title,
        price: variant.price,
        imageId: variant.image_id ? String(variant.image_id) : null,
        inventoryItemId: String(variant.inventory_item_id),
      })),
    };
  } catch (error) {
    if (error instanceof ShopifyNotFoundError) return null;
    throw error;
  }
}

export async function setInventory(
  shop: string,
  token: string,
  locationId: string,
  inventoryItemId: string,
  available: number
): Promise<void> {
  await shopify(shop, token, "inventory_levels/set.json", {
    method: "POST",
    body: JSON.stringify({
      location_id: Number(locationId),
      inventory_item_id: Number(inventoryItemId),
      available: Math.max(0, available),
    }),
  });
}

export async function deleteProduct(shop: string, token: string, productId: string): Promise<void> {
  await shopify(shop, token, `products/${productId}.json`, { method: "DELETE" });
}

export async function productExists(shop: string, token: string, productId: string): Promise<boolean> {
  try {
    await shopify(shop, token, `products/${productId}.json`);
    return true;
  } catch (error) {
    if (error instanceof ShopifyNotFoundError) return false;
    throw error;
  }
}

export async function readOrderAddress(
  shop: string,
  token: string,
  orderId: string
): Promise<{ name: string; street: string; country: string } | null> {
  const json = await shopify<{
    order: {
      shipping_address?: { name?: string; address1?: string; country?: string; country_code?: string };
    };
  }>(shop, token, `orders/${orderId}.json`);
  const address = json.order.shipping_address;
  if (!address?.address1 || !(address.country || address.country_code)) return null;
  return {
    name: address.name || "",
    street: address.address1,
    country: address.country_code || address.country || "",
  };
}

export async function createFulfillment(input: {
  shop: string;
  token: string;
  orderId: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  carrier?: string | null;
}): Promise<void> {
  const fulfillments = await shopify<{
    fulfillment_orders: Array<{ id: number; status: string }>;
  }>(
    input.shop,
    input.token,
    `orders/${input.orderId}/fulfillment_orders.json`
  );
  const open = fulfillments.fulfillment_orders.filter((row) => row.status === "open" || row.status === "in_progress");
  if (open.length === 0) return;
  await shopify(input.shop, input.token, "fulfillments.json", {
    method: "POST",
    body: JSON.stringify({
      fulfillment: {
        line_items_by_fulfillment_order: open.map((row) => ({ fulfillment_order_id: row.id })),
        tracking_info: {
          number: input.trackingNumber,
          url: input.trackingUrl || undefined,
          company: input.carrier || undefined,
        },
        notify_customer: true,
      },
    }),
  });
}

export async function downloadAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 8_000_000) return null;
    return bytes.toString("base64");
  } catch {
    return null;
  }
}
