import { env, guardWrite, bcCredentials } from "@/lib/env";

// ── Types ──────────────────────────────────────────────
export interface BCCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  customer_group_id: number;
  form_fields?: { name: string; value: string }[];
  store_credit_amounts?: Array<{
    amount: number;
  }>;
}

export interface BCOrder {
  id: number;
  customer_id: number;
  status: string;
  status_id: number;
  subtotal_ex_tax: string;
  subtotal_inc_tax: string;
  total_ex_tax: string;
  total_inc_tax: string;
  discount_amount?: string;
  coupon_discount?: string;
  date_created: string;
  payment_status: string;
  currency_code: string;
  items_total: number;
  billing_address: { country: string; country_iso2: string };
  products?: { url: string };
  shipping_addresses?: { url: string };
  coupons?: { url: string };
}

export interface BCOrderProduct {
  id: number;
  order_id: number;
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  price_ex_tax: string;
}

export interface BCShipment {
  id: number;
  order_id: number;
  tracking_number: string;
  shipping_method: string;
  date_created: string;
}

export interface BCPromotion {
  id: number;
  name: string;
  status: string;
  rules: unknown[];
  notifications: unknown[];
}

export interface BCCustomerGroup {
  id: number;
  name: string;
  is_default: boolean;
  category_access: { type: string };
  discount_rules: unknown[];
}

export interface BCProductImage {
  id: number;
  product_id: number;
  url_standard: string;
  url_thumbnail: string;
  url_tiny: string;
  is_thumbnail: boolean;
  sort_order: number;
  description: string;
}

export interface BCProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  sale_price: number;
  retail_price: number;
  calculated_price: number;
  inventory_level: number;
  inventory_tracking: string;
  is_visible: boolean;
  availability: string;
  custom_url: { url: string; is_customized: boolean };
  images?: BCProductImage[];
}

// ── Client ─────────────────────────────────────────────
class BigCommerceClient {
  private storeHash: string;
  private accessToken: string;

  constructor() {
    const creds = bcCredentials();
    this.storeHash = creds.storeHash;
    this.accessToken = creds.accessToken;
  }

  private get baseV2() {
    return `https://api.bigcommerce.com/stores/${this.storeHash}/v2`;
  }

  private get baseV3() {
    return `https://api.bigcommerce.com/stores/${this.storeHash}/v3`;
  }

  private get headers() {
    return {
      "X-Auth-Token": this.accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // ── Generic fetch helpers ──────────────────────────
  /** Sleep for ms (for 429 retry backoff) */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async get<T>(url: string, attempt = 1): Promise<T> {
    const maxAttempts = 5;
    const res = await fetch(url, { headers: this.headers, cache: "no-store" });

    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = res.headers.get("X-Rate-Limit-Time-Reset-Ms");
      const delayMs = retryAfter
        ? Math.min(parseInt(retryAfter, 10) + 200, 15000)
        : Math.min(1000 * Math.pow(2, attempt), 15000);
      await this.sleep(delayMs);
      return this.get<T>(url, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`BC API GET ${url} failed (${res.status}): ${text}`);
    }
    // V2 endpoints can return 200 with an empty body (e.g. no orders)
    const text = await res.text();
    if (!text || text.trim() === "") {
      return [] as unknown as T;
    }
    return JSON.parse(text);
  }

  private async post<T>(url: string, body: unknown): Promise<T> {
    guardWrite(`POST ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`BC API POST ${url} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  private async put<T>(url: string, body: unknown): Promise<T> {
    guardWrite(`PUT ${url}`);
    const res = await fetch(url, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`BC API PUT ${url} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  private async delete(url: string): Promise<void> {
    guardWrite(`DELETE ${url}`);
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      throw new Error(`BC API DELETE ${url} failed (${res.status}): ${text}`);
    }
  }

  // ── Store info ─────────────────────────────────────
  async getStoreInfo(): Promise<{ name: string; domain: string; plan_name: string }> {
    return this.get(`${this.baseV2}/store`);
  }

  // ── Customers ──────────────────────────────────────
  async getCustomerByEmail(email: string): Promise<BCCustomer | null> {
    const res = await this.get<{ data: BCCustomer[] }>(
      `${this.baseV3}/customers?email:in=${encodeURIComponent(email)}&include=formfields`
    );
    return res.data?.[0] ?? null;
  }

  async getCustomerById(id: number): Promise<BCCustomer | null> {
    const res = await this.get<{ data: BCCustomer[] }>(
      `${this.baseV3}/customers?id:in=${id}&include=formfields,storecredit`
    );
    return res.data?.[0] ?? null;
  }

  async createCustomer(data: {
    email: string;
    first_name: string;
    last_name: string;
    company?: string;
  }): Promise<BCCustomer> {
    const res = await this.post<{ data: BCCustomer[] }>(
      `${this.baseV3}/customers`,
      [data]
    );
    return res.data[0];
  }

  async updateCustomerGroup(customerId: number, groupId: number): Promise<void> {
    await this.put(`${this.baseV3}/customers`, [
      { id: customerId, customer_group_id: groupId },
    ]);
  }

  async updateCustomerProfile(
    customerId: number,
    data: {
      company?: string;
      phone?: string;
      first_name?: string;
      last_name?: string;
    }
  ): Promise<void> {
    guardWrite("updateCustomerProfile");
    await this.put(`${this.baseV3}/customers`, [{ id: customerId, ...data }]);
  }

  // ── Customer groups ────────────────────────────────
  async getCustomerGroups(): Promise<BCCustomerGroup[]> {
    const res = await this.get<BCCustomerGroup[]>(`${this.baseV2}/customer_groups`);
    return res;
  }

  async getCustomerGroupByName(name: string): Promise<BCCustomerGroup | null> {
    const groups = await this.getCustomerGroups();
    return groups.find((g) => g.name === name) ?? null;
  }

  async createCustomerGroup(name: string): Promise<BCCustomerGroup> {
    return this.post<BCCustomerGroup>(`${this.baseV2}/customer_groups`, {
      name,
      is_default: false,
      category_access: { type: "all" },
      discount_rules: [],
    });
  }

  // ── Orders ─────────────────────────────────────────
  async getOrders(params: {
    customer_id: number;
    min_date_created?: string;
    limit?: number;
    page?: number;
    status_id?: number;
    sort?: string;
    direction?: string;
  }): Promise<BCOrder[]> {
    const qs = new URLSearchParams();
    qs.set("customer_id", String(params.customer_id));
    if (params.min_date_created) qs.set("min_date_created", params.min_date_created);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.page) qs.set("page", String(params.page));
    if (params.status_id) qs.set("status_id", String(params.status_id));
    if (params.sort) qs.set("sort", params.sort);
    if (params.direction) qs.set("direction", params.direction);

    const res = await this.get<BCOrder[]>(`${this.baseV2}/orders?${qs.toString()}`);
    return res || [];
  }

  async getOrderById(orderId: number): Promise<BCOrder | null> {
    try {
      return await this.get<BCOrder>(`${this.baseV2}/orders/${orderId}`);
    } catch {
      return null;
    }
  }

  async getOrderProducts(orderId: number): Promise<BCOrderProduct[]> {
    return this.get(`${this.baseV2}/orders/${orderId}/products`);
  }

  async getOrderShipments(orderId: number): Promise<BCShipment[]> {
    try {
      return await this.get(`${this.baseV2}/orders/${orderId}/shipments`);
    } catch {
      return []; // No shipments
    }
  }

  async getOrderCoupons(orderId: number): Promise<{ id: number; coupon_id: number; code: string; amount: string; type: number; discount: string }[]> {
    try {
      return await this.get(`${this.baseV2}/orders/${orderId}/coupons`);
    } catch {
      return [];
    }
  }

  // ── Promotions ─────────────────────────────────────
  async getPromotions(): Promise<{ data: BCPromotion[] }> {
    return this.get(`${this.baseV3}/promotions`);
  }

  async createPromotion(promo: unknown): Promise<{ data: BCPromotion }> {
    return this.post(`${this.baseV3}/promotions`, promo);
  }

  async updatePromotion(id: number, promo: unknown): Promise<{ data: BCPromotion }> {
    return this.put(`${this.baseV3}/promotions/${id}`, promo);
  }

  async deletePromotion(id: number): Promise<void> {
    return this.delete(`${this.baseV3}/promotions/${id}`);
  }

  // ── Coupon codes ───────────────────────────────────
  async createCouponCode(
    promotionId: number,
    code: string
  ): Promise<unknown> {
    return this.post(
      `${this.baseV3}/promotions/${promotionId}/codes`,
      { code }
    );
  }

  // ── Webhooks ───────────────────────────────────────
  async getWebhooks(): Promise<{ data: unknown[] }> {
    return this.get(`${this.baseV3}/hooks`);
  }

  async createWebhook(data: {
    scope: string;
    destination: string;
    is_active: boolean;
    headers?: Record<string, string>;
  }): Promise<unknown> {
    return this.post(`${this.baseV3}/hooks`, data);
  }

  async deleteWebhook(id: number): Promise<void> {
    return this.delete(`${this.baseV3}/hooks/${id}`);
  }

  // ── Products (V3 Catalog) ───────────────────────────
  async getProducts(params: {
    sort?: string;
    direction?: string;
    limit?: number;
    include?: string;
    is_visible?: boolean;
  }): Promise<{ data: BCProduct[] }> {
    const qs = new URLSearchParams();
    if (params.sort) qs.set("sort", params.sort);
    if (params.direction) qs.set("direction", params.direction);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.include) qs.set("include", params.include);
    if (params.is_visible !== undefined) qs.set("is_visible", String(params.is_visible));
    return this.get<{ data: BCProduct[] }>(
      `${this.baseV3}/catalog/products?${qs.toString()}`
    );
  }

  async getProductById(id: number): Promise<BCProduct | null> {
    try {
      const res = await this.get<{ data: BCProduct }>(
        `${this.baseV3}/catalog/products/${id}?include=images`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  // ── Store domain helper ─────────────────────────────
  getStoreDomain(): string {
    // Returns the storefront domain for cart links
    return `store-${this.storeHash}.mybigcommerce.com`;
  }
}

// Singleton per request (Next.js serverless)
let _client: BigCommerceClient | null = null;

export function bc(): BigCommerceClient {
  if (!_client) {
    _client = new BigCommerceClient();
  }
  return _client;
}
