import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";
import { decrypt } from "@/lib/bigcommerce/encryption";
import {
  getTierDiscountPercent,
  isWelcomeActive,
  loadWelcomeConfig,
} from "@/lib/tier-engine";
import { atLeastOneBusinessDayLater } from "./calendar";
import { decidePaidOrder } from "./decide";
import { quoteChannelCharge, roundMoney } from "./money";
import { emailAccount, emailWholesaleDesk } from "./notify";
import { isShopifyChannelEnabled } from "./settings";
import { chargeCard, refundCharge } from "./stripe";

const LOCKED = new Set(["SUBMITTED", "PICKING", "SHIPPED", "REFUNDED", "FAILED"]);

export interface ShopifyOrderPayload {
  id: number | string;
  name?: string;
  financial_status?: string;
  note?: string | null;
  phone?: string | null;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    province_code?: string | null;
    country?: string | null;
    country_code?: string | null;
    zip?: string | null;
    phone?: string | null;
  } | null;
  line_items?: Array<{
    variant_id?: number | null;
    title?: string | null;
    quantity?: number | null;
    price?: string | null;
    discount_allocations?: Array<{ amount?: string | null }>;
  }>;
}

function shipTo(order: ShopifyOrderPayload) {
  const address = order.shipping_address;
  const country = address?.country_code || address?.country || "";
  const phone = address?.phone || order.phone || "";
  return {
    name: address?.name || [address?.first_name, address?.last_name].filter(Boolean).join(" "),
    firstName: address?.first_name || "",
    lastName: address?.last_name || "",
    street: address?.address1 || "",
    street2: address?.address2 || "",
    city: address?.city || "",
    province: address?.province_code || address?.province || "",
    country,
    zip: address?.zip || "",
    phone,
  };
}

function saleUnit(item: NonNullable<ShopifyOrderPayload["line_items"]>[number]): number {
  const qty = item.quantity || 0;
  const price = Number(item.price || 0);
  const discount = (item.discount_allocations || []).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  if (qty <= 0) return roundMoney(price);
  return roundMoney(Math.max(0, price * qty - discount) / qty);
}

async function discountFor(account: {
  lastTier: string;
  welcomeExpiresAt: Date | null;
}): Promise<{ tier: string; percent: number }> {
  const earned = await getTierDiscountPercent(account.lastTier);
  if (!isWelcomeActive(account.welcomeExpiresAt)) {
    return { tier: account.lastTier, percent: earned };
  }
  const welcome = await loadWelcomeConfig();
  if (welcome.enabled && welcome.discount > earned) {
    return { tier: "WELCOME", percent: welcome.discount };
  }
  return { tier: account.lastTier, percent: earned };
}

export async function ingestShopifyOrder(connectionId: string, order: ShopifyOrderPayload): Promise<void> {
  const connection = await db.shopifyConnection.findUnique({
    where: { id: connectionId },
    include: { account: { include: { sellerPaymentMethod: true } } },
  });
  if (!connection || connection.disconnectedAt || !connection.account) return;

  const shopifyOrderId = String(order.id);
  const existing = await db.channelOrder.findUnique({
    where: { connectionId_shopifyOrderId: { connectionId, shopifyOrderId } },
  });
  if (existing && (existing.bcOrderId || LOCKED.has(existing.status))) return;

  const destination = shipTo(order);
  const variantIds = (order.line_items || [])
    .map((item) => (item.variant_id == null ? "" : String(item.variant_id)))
    .filter(Boolean);
  const listings = variantIds.length
    ? await db.channelListing.findMany({
        where: { connectionId, removedAt: null, shopifyVariantId: { in: variantIds } },
      })
    : [];
  const byVariant = new Map(listings.map((row) => [row.shopifyVariantId, row]));

  const { tier, percent } = await discountFor(connection.account);
  const quotedLines: Array<{
    shopifyVariantId: string;
    title: string;
    quantity: number;
    salePrice: number;
    retail: number;
    bcProductId: number;
    bcVariantId: number;
    unitCost: number;
    lineCost: number;
  }> = [];
  let stockOk = true;

  for (const item of order.line_items || []) {
    const variantId = item.variant_id == null ? "" : String(item.variant_id);
    const listing = byVariant.get(variantId);
    const quantity = item.quantity || 0;
    if (!listing || quantity <= 0) {
      stockOk = false;
      continue;
    }
    const product = await bc().getProductById(listing.bcProductId);
    const variant =
      listing.bcVariantId > 0
        ? product?.variants?.find((row) => row.id === listing.bcVariantId)
        : undefined;
    const retail = variant?.calculated_price || variant?.price || product?.calculated_price || product?.price || 0;
    const onHand = !product?.is_visible
      ? 0
      : variant
        ? variant.inventory_level
        : product.inventory_level;
    if (!product || onHand < quantity) stockOk = false;
    const unitCost = roundMoney(retail * (1 - Math.min(100, Math.max(0, percent)) / 100));
    quotedLines.push({
      shopifyVariantId: variantId,
      title: item.title || listing.titleSnapshot,
      quantity,
      salePrice: saleUnit(item),
      retail,
      bcProductId: listing.bcProductId,
      bcVariantId: listing.bcVariantId,
      unitCost,
      lineCost: roundMoney(unitCost * quantity),
    });
  }

  const quote = quoteChannelCharge(
    quotedLines.map((line) => ({
      retail: line.retail,
      quantity: line.quantity,
      discountPercent: percent,
      salePrice: line.salePrice,
    })),
    destination.country
  );

  const channelEnabled = await isShopifyChannelEnabled();
  const decision = decidePaidOrder({
    financialStatus: order.financial_status,
    channelEnabled,
    storePaused: connection.paused,
    addressTestPassed: connection.addressTestStatus === "PASSED",
    street: destination.street,
    country: destination.country,
    phone: destination.phone,
    stockOk: stockOk && quotedLines.length === (order.line_items || []).length,
    hasCard: Boolean(connection.account.sellerPaymentMethod),
  });

  if (decision.action === "ignore") return;

  const status =
    decision.action === "queue"
      ? "QUEUED"
      : decision.action === "hold"
        ? decision.reason === "card_missing" || decision.reason === "card_declined"
          ? "NEEDS_ATTENTION"
          : "HELD"
        : "HELD";

  const saved = await db.channelOrder.upsert({
    where: { connectionId_shopifyOrderId: { connectionId, shopifyOrderId } },
    create: {
      accountId: connection.accountId,
      connectionId,
      shopifyOrderId,
      shopifyOrderName: order.name || `#${shopifyOrderId}`,
      status,
      tier,
      soldFor: quote.soldFor,
      goodsCharged: quote.goods,
      shippingCharged: quote.shipping,
      amountCharged: 0,
      shipTo: destination,
      lines: quotedLines,
      checkoutNote: order.note || null,
      attentionNote: decision.action === "hold" ? decision.reason : null,
    },
    update: {
      shopifyOrderName: order.name || `#${shopifyOrderId}`,
      status: existing && existing.status === "NEEDS_ATTENTION" && decision.action === "hold" ? "NEEDS_ATTENTION" : status,
      tier,
      soldFor: quote.soldFor,
      goodsCharged: quote.goods,
      shippingCharged: quote.shipping,
      shipTo: destination,
      lines: quotedLines,
      checkoutNote: order.note || null,
      attentionNote: decision.action === "hold" ? decision.reason : null,
    },
  });

  const accountEmail = connection.account.email;
  const orderName = saved.shopifyOrderName;

  if (decision.action === "queue") return;

  if (decision.action === "hold") {
    if (decision.reason === "incomplete_address" || decision.reason === "missing_phone") {
      await db.shopifyConnection.update({
        where: { id: connection.id },
        data: { addressTestStatus: "FAILED" },
      });
    }
    if (existing?.attentionNote !== decision.reason) {
      await emailAccount(
        accountEmail,
        `Shopify order ${orderName} needs attention`,
        holdMessage(orderName, decision.reason)
      );
      if (decision.reason === "card_missing" || decision.reason === "card_declined") {
        await emailWholesaleDesk(
          `Card problem on ${orderName}`,
          `${connection.account.companyName} order ${orderName} was not charged. Reason: ${decision.reason}.`
        );
      }
    }
    return;
  }

  const card = connection.account.sellerPaymentMethod;
  if (!card) return;

  const attempts = saved.chargeAttempts;
  let chargeId = saved.stripeChargeId;
  if (!chargeId) {
    let lastError = "Card declined";
    for (let attempt = attempts + 1; attempt <= 2 && !chargeId; attempt++) {
      try {
        const charged = await chargeCard({
          customerId: card.stripeCustomerId,
          paymentMethodId: card.stripePaymentMethodId,
          amountCents: Math.round(quote.total * 100),
          idempotencyKey: `channel-${connection.id}-${shopifyOrderId}-${attempt}`,
          description: `Wholesale ${orderName}`,
        });
        chargeId = charged.chargeId || charged.paymentIntentId;
        await db.channelOrder.update({
          where: { id: saved.id },
          data: {
            stripeChargeId: chargeId,
            amountCharged: quote.total,
            chargedAt: new Date(),
            chargeAttempts: attempt,
            status: "CHARGED",
            error: null,
          },
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Card declined";
        await db.channelOrder.update({
          where: { id: saved.id },
          data: { chargeAttempts: attempt, error: lastError },
        });
      }
    }
    if (!chargeId) {
      await db.channelOrder.update({
        where: { id: saved.id },
        data: { status: "NEEDS_ATTENTION", attentionNote: "card_declined", error: lastError },
      });
      await emailAccount(
        accountEmail,
        `Shopify order ${orderName} was not charged`,
        `We could not charge the card on file for ${orderName}. Nothing shipped. Save a working card in Billing and we will retry the oldest unpaid order.`
      );
      await emailWholesaleDesk(
        `Card declined for ${orderName}`,
        `${connection.account.companyName} ${orderName} amount ${quote.total.toFixed(2)} was not charged. ${lastError}`
      );
      return;
    }
  }

  try {
    if (!connection.account.customerId) {
      throw new Error("This wholesale account is not linked to a warehouse customer");
    }
    const warehouse = await bc().createOrder(
      warehouseOrder({
        customerId: connection.account.customerId,
        email: accountEmail,
        companyName: connection.account.companyName,
        businessAddress: connection.account.businessAddress,
        phone: connection.account.phone,
        primaryState: connection.account.primaryState,
        destination,
        lines: quotedLines,
        shipping: quote.shipping,
        note: order.note || "",
        staff: `${orderName}. Stripe ${chargeId}`,
      })
    );
    await db.channelOrder.update({
      where: { id: saved.id },
      data: { bcOrderId: warehouse.id, status: "SUBMITTED", error: null, attentionNote: null },
    });
    await emailAccount(
      accountEmail,
      `We charged ${orderName}`,
      [
        `${orderName} is charged and sent to the warehouse.`,
        `Products: ${quotedLines.map((line) => `${line.title} x${line.quantity} at $${line.unitCost.toFixed(2)}`).join("; ")}`,
        `Shipping: $${quote.shipping.toFixed(2)}`,
        `Total charged: $${quote.total.toFixed(2)}`,
        `Card ending ${card.last4}. Statement name THE PERFECT PART.`,
        `Ship to: ${destination.name}, ${destination.street}, ${destination.city} ${destination.province} ${destination.zip} ${destination.country}`,
        `Warehouse order ${warehouse.id}. We ship the same day or the next business day.`,
      ].join("\n")
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Warehouse order failed";
    let refundNote = message;
    if (chargeId) {
      try {
        await refundCharge(chargeId);
      } catch (refundError) {
        refundNote = `${message}. Refund also failed: ${refundError instanceof Error ? refundError.message : "unknown"}`;
      }
    }
    await db.channelOrder.update({
      where: { id: saved.id },
      data: {
        status: "FAILED",
        amountRefunded: quote.total,
        error: refundNote,
        attentionNote: "warehouse_create_failed",
      },
    });
    await emailAccount(
      accountEmail,
      `We refunded ${orderName}`,
      `We charged ${orderName} and could not create the warehouse order, so the charge was refunded. Nothing shipped.`
    );
    await emailWholesaleDesk(
      `Warehouse order failed for ${orderName}`,
      `${connection.account.companyName} ${orderName} was refunded after the warehouse order failed. ${message}`
    );
  }
}

function holdMessage(orderName: string, reason: string): string {
  if (reason === "store_paused") {
    return `${orderName} arrived while new orders are paused. We did not charge you and we will not ship it. Refund your customer.`;
  }
  if (reason === "incomplete_address") {
    return `${orderName} is missing a street or country. We did not charge you. Add the address on that Shopify order and we will charge and ship it.`;
  }
  if (reason === "missing_phone") {
    return `${orderName} is outside the US and has no phone number. We did not charge you. Add a phone on that Shopify order and we will charge and ship it.`;
  }
  if (reason === "out_of_stock") {
    return `${orderName} does not have enough stock. We did not charge you and we will not ship it. Refund your customer.`;
  }
  if (reason === "needs_retest") {
    return `${orderName} arrived before we could confirm shipping addresses for that store. We did not charge you. Open My Shopify and run the address test.`;
  }
  return `${orderName} needs a working card before we can ship. Nothing was charged.`;
}

function warehouseOrder(input: {
  customerId: number | null;
  email: string;
  companyName: string;
  businessAddress: string | null;
  phone: string | null;
  primaryState: string | null;
  destination: ReturnType<typeof shipTo>;
  lines: Array<{ bcProductId: number; bcVariantId: number; quantity: number; unitCost: number; title: string }>;
  shipping: number;
  note: string;
  staff: string;
}): Record<string, unknown> {
  const ship = input.destination;
  return {
    status_id: 11,
    customer_id: input.customerId || 0,
    external_source: "Shopify Channel",
    staff_notes: input.staff,
    customer_message: input.note,
    billing_address: {
      first_name: input.companyName.slice(0, 40) || "Wholesale",
      last_name: "Account",
      company: input.companyName,
      street_1: (input.businessAddress || "Wholesale account on file").slice(0, 255),
      city: "Pompano Beach",
      state: input.primaryState || "FL",
      zip: "33069",
      country: "United States",
      country_iso2: "US",
      email: input.email,
      phone: input.phone || "",
    },
    shipping_addresses: [
      {
        first_name: ship.firstName || ship.name || "Customer",
        last_name: ship.lastName || "Order",
        street_1: ship.street,
        street_2: ship.street2,
        city: ship.city,
        state: ship.province,
        zip: ship.zip,
        country: ship.country,
        country_iso2: ship.country.length === 2 ? ship.country : undefined,
        phone: ship.phone,
        email: input.email,
        shipping_method: input.shipping > 0 ? "International flat" : "US free shipping",
      },
    ],
    products: input.lines.map((line) => ({
      product_id: line.bcProductId,
      variant_id: line.bcVariantId > 0 ? line.bcVariantId : undefined,
      quantity: line.quantity,
      price_ex_tax: line.unitCost.toFixed(2),
      price_inc_tax: line.unitCost.toFixed(2),
      name: line.title,
    })),
    shipping_cost_ex_tax: input.shipping.toFixed(2),
    shipping_cost_inc_tax: input.shipping.toFixed(2),
  };
}

export async function drainQueuedChannelOrders(limit = 10): Promise<number> {
  if (!(await isShopifyChannelEnabled())) return 0;
  const queued = await db.channelOrder.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { connection: true },
  });
  let processed = 0;
  for (const row of queued) {
    const token = row.connection.orderTokenEnc
      ? decrypt(row.connection.orderTokenEnc)
      : row.connection.accessTokenEnc
        ? decrypt(row.connection.accessTokenEnc)
        : null;
    if (!token) continue;
    const { readOrderAddress } = await import("./shopify-admin");
    const address = await readOrderAddress(row.connection.shopDomain, token, row.shopifyOrderId).catch(() => null);
    const payload = (row.shipTo || {}) as {
      name?: string;
      street?: string;
      street2?: string;
      city?: string;
      province?: string;
      country?: string;
      zip?: string;
      phone?: string;
    };
    const storedLines = Array.isArray(row.lines)
      ? (row.lines as Array<{ shopifyVariantId?: string; quantity?: number; title?: string; salePrice?: number }>)
      : [];
    await ingestShopifyOrder(row.connectionId, {
      id: row.shopifyOrderId,
      name: row.shopifyOrderName,
      financial_status: "paid",
      note: row.checkoutNote,
      phone: payload.phone,
      shipping_address: {
        name: address?.name || payload.name,
        address1: address?.street || payload.street,
        address2: payload.street2,
        city: payload.city,
        province: payload.province,
        country: address?.country || payload.country,
        zip: payload.zip,
        phone: payload.phone,
      },
      line_items: storedLines.map((line) => ({
        variant_id: Number(line.shopifyVariantId || 0) || undefined,
        quantity: line.quantity,
        title: line.title,
        price: line.salePrice != null ? String(line.salePrice) : undefined,
      })),
    });
    processed += 1;
  }
  return processed;
}

export async function retryCardAttention(accountId: string): Promise<void> {
  const rows = await db.channelOrder.findMany({
    where: {
      accountId,
      status: "NEEDS_ATTENTION",
      attentionNote: { in: ["card_missing", "card_declined"] },
    },
    orderBy: { createdAt: "asc" },
    include: { connection: true },
  });
  for (const row of rows) {
    await db.channelOrder.update({
      where: { id: row.id },
      data: { chargeAttempts: 0, status: "HELD", attentionNote: null, error: null },
    });
    const payload = (row.shipTo || {}) as {
      name?: string;
      street?: string;
      street2?: string;
      city?: string;
      province?: string;
      country?: string;
      zip?: string;
      phone?: string;
    };
    const storedLines = Array.isArray(row.lines)
      ? (row.lines as Array<{ shopifyVariantId?: string; quantity?: number; title?: string; salePrice?: number }>)
      : [];
    await ingestShopifyOrder(row.connectionId, {
      id: row.shopifyOrderId,
      name: row.shopifyOrderName,
      financial_status: "paid",
      note: row.checkoutNote,
      phone: payload.phone,
      shipping_address: {
        name: payload.name,
        address1: payload.street,
        address2: payload.street2,
        city: payload.city,
        province: payload.province,
        country: payload.country,
        zip: payload.zip,
        phone: payload.phone,
      },
      line_items: storedLines.map((line) => ({
        variant_id: Number(line.shopifyVariantId || 0) || undefined,
        quantity: line.quantity,
        title: line.title,
        price: line.salePrice != null ? String(line.salePrice) : undefined,
      })),
    });
  }
}

export async function remindStaleCardAttention(now = new Date()): Promise<number> {
  const rows = await db.channelOrder.findMany({
    where: {
      status: "NEEDS_ATTENTION",
      remindedAt: null,
      attentionNote: { in: ["card_missing", "card_declined"] },
    },
    include: { account: true },
    take: 25,
    orderBy: { updatedAt: "asc" },
  });
  let sent = 0;
  for (const row of rows) {
    if (!atLeastOneBusinessDayLater(row.updatedAt, now)) continue;
    await emailAccount(
      row.account.email,
      "A Shopify sale still needs a card",
      `${row.shopifyOrderName} is still unpaid on our side. Save a working card in Billing and we will retry it. We do not close this for you.`
    );
    await db.channelOrder.update({ where: { id: row.id }, data: { remindedAt: now } });
    sent += 1;
  }
  return sent;
}
