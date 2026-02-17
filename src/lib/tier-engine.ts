import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import { formatCouponCode, toAlias } from "@/lib/utils";

// ── Tier types ──────────────────────────────────────────
export interface TierDef {
  id: string;       // e.g. "T10", "T15", "T20"
  label: string;    // e.g. "10% Off"
  minOrders: number;
  discount: number; // percentage
}

/** TierId is now a plain string ("NONE" | "T10" | "T15" | …) */
export type TierId = string;

// ── Default tiers (fallback when no DB config exists) ──
export const DEFAULT_TIERS: TierDef[] = [
  { id: "T10", label: "10% Off", minOrders: 5, discount: 10 },
  { id: "T15", label: "15% Off", minOrders: 25, discount: 15 },
  { id: "T20", label: "20% Off", minOrders: 50, discount: 20 },
  { id: "T25", label: "25% Off", minOrders: 100, discount: 25 },
  { id: "T30", label: "30% Off", minOrders: 200, discount: 30 },
];

/**
 * @deprecated Use loadTiers() for dynamic tiers.
 * Kept for backwards-compatible imports.
 */
export const TIERS = DEFAULT_TIERS;

// ── Load tiers from GlobalSettings ──────────────────────
/**
 * Reads the tier configuration from the GlobalSettings table.
 * Falls back to DEFAULT_TIERS if no config exists.
 * Always returns tiers sorted by minOrders ascending.
 */
export async function loadTiers(): Promise<TierDef[]> {
  try {
    const row = await db.globalSettings.findUnique({ where: { id: "global" } });
    const settings = row?.settings as Record<string, unknown> | null;
    if (settings && Array.isArray(settings.tiers) && settings.tiers.length > 0) {
      const tiers = (settings.tiers as TierDef[]).sort(
        (a, b) => a.minOrders - b.minOrders
      );
      return tiers;
    }
  } catch {
    // DB not available or parse error — use defaults
  }
  return [...DEFAULT_TIERS];
}

/**
 * Save tier configuration to GlobalSettings.
 * Merges with existing settings (preserves other keys).
 */
export async function saveTiers(tiers: TierDef[]): Promise<void> {
  const row = await db.globalSettings.findUnique({ where: { id: "global" } });
  const existingSettings = (row?.settings as Record<string, unknown>) || {};
  const merged = JSON.parse(JSON.stringify({ ...existingSettings, tiers })) as Prisma.InputJsonValue;
  await db.globalSettings.upsert({
    where: { id: "global" },
    create: { id: "global", settings: merged },
    update: { settings: merged },
  });
}

// ── Welcome discount settings ─────────────────────────
export interface WelcomeDiscountConfig {
  enabled: boolean;
  discount: number; // percentage
  hours: number;    // duration in hours
}

const DEFAULT_WELCOME: WelcomeDiscountConfig = {
  enabled: true,
  discount: 20,
  hours: 72,
};

/** Load welcome discount settings from GlobalSettings */
export async function loadWelcomeConfig(): Promise<WelcomeDiscountConfig> {
  try {
    const row = await db.globalSettings.findUnique({ where: { id: "global" } });
    const settings = row?.settings as Record<string, unknown> | null;
    if (settings?.welcomeDiscount) {
      const w = settings.welcomeDiscount as Partial<WelcomeDiscountConfig>;
      return {
        enabled: w.enabled ?? DEFAULT_WELCOME.enabled,
        discount: w.discount ?? DEFAULT_WELCOME.discount,
        hours: w.hours ?? DEFAULT_WELCOME.hours,
      };
    }
  } catch { /* use defaults */ }
  return { ...DEFAULT_WELCOME };
}

/** Save welcome discount settings to GlobalSettings */
export async function saveWelcomeConfig(config: WelcomeDiscountConfig): Promise<void> {
  const row = await db.globalSettings.findUnique({ where: { id: "global" } });
  const existingSettings = (row?.settings as Record<string, unknown>) || {};
  const merged = JSON.parse(
    JSON.stringify({ ...existingSettings, welcomeDiscount: config })
  ) as Prisma.InputJsonValue;
  await db.globalSettings.upsert({
    where: { id: "global" },
    create: { id: "global", settings: merged },
    update: { settings: merged },
  });
}

/** Check if an account is still in its welcome discount window */
export function isWelcomeActive(welcomeExpiresAt: Date | null): boolean {
  if (!welcomeExpiresAt) return false;
  return new Date() < welcomeExpiresAt;
}

/** Determine the tier from a 7-day order count (async, reads DB) */
export async function tierFromCount(count: number): Promise<TierId> {
  const tiers = await loadTiers();
  // Walk tiers from highest to lowest minOrders
  const sorted = [...tiers].sort((a, b) => b.minOrders - a.minOrders);
  for (const t of sorted) {
    if (count >= t.minOrders) return t.id;
  }
  return "NONE";
}

/** Get the tier config for a tier ID (async, reads DB) */
export async function getTierConfig(tierId: TierId): Promise<TierDef | null> {
  if (tierId === "WELCOME") {
    const welcomeCfg = await loadWelcomeConfig();
    return {
      id: "WELCOME",
      label: `Welcome ${welcomeCfg.discount}% Off`,
      minOrders: 0,
      discount: welcomeCfg.discount,
    };
  }
  const tiers = await loadTiers();
  return tiers.find((t) => t.id === tierId) ?? null;
}

/**
 * Recalculate tier for a single wholesale account.
 *
 * Steps:
 * 1. Fetch paid orders from BC in the last 7 days for this customer
 * 2. Filter to US-only orders with at least 1 shipment
 * 3. Count qualifying orders
 * 4. Determine new tier
 * 5. If tier changed → create/enable/disable promotions as needed
 * 6. Save snapshot + update account
 */
export async function recalcTier(accountId: string): Promise<{
  previousTier: TierId;
  newTier: TierId;
  count7d: number;
  changed: boolean;
}> {
  const account = await db.wholesaleAccount.findUnique({
    where: { id: accountId },
    include: { promotions: true },
  });

  if (!account || account.status !== "APPROVED" || !account.customerId) {
    return { previousTier: "NONE", newTier: "NONE", count7d: 0, changed: false };
  }

  if (account.pausedUpgrades) {
    // Tier is locked by admin — don't change it, but still ensure the
    // promotion exists (retries BC API if a previous attempt failed).
    await ensurePromoForTier(account.id, account.alias, account.lastTier as TierId);
    return {
      previousTier: account.lastTier as TierId,
      newTier: account.lastTier as TierId,
      count7d: account.lastCount7d,
      changed: false,
    };
  }

  const previousTier = account.lastTier as TierId;

  // Fetch orders from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const minDate = sevenDaysAgo.toISOString().replace("T", " ").replace("Z", "");

  let allOrders: BCOrder[] = [];
  let page = 1;
  const limit = 250;

  while (true) {
    const orders = await bc().getOrders({
      customer_id: account.customerId,
      min_date_created: minDate,
      limit,
      page,
    });

    if (!orders || orders.length === 0) break;
    allOrders = allOrders.concat(orders);
    if (orders.length < limit) break;
    page++;
  }

  // Qualifying orders: any order that was at some point shipped.
  // Status IDs: 2=Shipped, 3=Partially Shipped, 10=Completed, 14=Partially Refunded
  // All of these imply the order was fulfilled/shipped at some point.
  // Once an order qualifies, a later status change does not deduct it.
  const qualifyingStatusIds = [2, 3, 10, 14];
  const qualifyingCount = allOrders.filter((o) =>
    qualifyingStatusIds.includes(o.status_id)
  ).length;

  let newTier = await tierFromCount(qualifyingCount);

  // ── Welcome discount: use whichever is higher ──────────
  const welcomeActive = isWelcomeActive(account.welcomeExpiresAt);
  if (welcomeActive) {
    const welcomeCfg = await loadWelcomeConfig();
    if (welcomeCfg.enabled) {
      // Find or create a virtual tier for the welcome discount
      const earnedConfig = await getTierConfig(newTier);
      const earnedDiscount = earnedConfig?.discount ?? 0;
      if (welcomeCfg.discount > earnedDiscount) {
        // Welcome discount is better — use it as the active tier
        newTier = `WELCOME`;
      }
    }
  } else if (account.welcomeExpiresAt && previousTier === "WELCOME") {
    // Welcome just expired — the earned tier will naturally take over
    // (newTier is already set to the earned tier above)
  }

  const changed = newTier !== previousTier;

  // Save tier snapshot
  await db.tierSnapshot.create({
    data: {
      accountId: account.id,
      asOf: new Date(),
      paidOrders7d: qualifyingCount,
      tierLevel: newTier,
      activeCode: account.promotions.find((p) => p.enabled)?.code || null,
    },
  });

  // Update account
  await db.wholesaleAccount.update({
    where: { id: account.id },
    data: {
      lastTier: newTier,
      lastCount7d: qualifyingCount,
    },
  });

  // Always ensure the correct promotion is active for the current tier.
  // This handles: tier changes, retries after failed BC API calls, and
  // ensuring a promotion exists even if the tier hasn't changed.
  await ensurePromoForTier(account.id, account.alias, newTier);

  if (changed) {
    // Audit log
    await db.auditLog.create({
      data: {
        actorEmail: "system",
        action: "tier_changed",
        targetCustomerId: account.customerId,
        targetAccountId: account.id,
        details: {
          from: previousTier,
          to: newTier,
          count7d: qualifyingCount,
        },
      },
    });
  }

  return { previousTier, newTier, count7d: qualifyingCount, changed };
}

/**
 * Ensure the correct promotion is active for the given tier.
 * Disables all promotions that don't match the current tier,
 * then ensures the current tier's promotion exists and is enabled.
 *
 * This runs on EVERY recalc (not just tier changes) so that:
 * - Failed BigCommerce API calls are retried on the next recalc
 * - Manually enrolled customers always get a coupon created
 * - The coupon code is always visible on the dashboard
 */
export async function ensurePromoForTier(
  accountId: string,
  alias: string,
  currentTier: TierId
): Promise<void> {
  // Disable all promotions that are NOT for the current tier (or all if NONE)
  const enabledPromos = await db.promotionRecord.findMany({
    where: { accountId, enabled: true },
  });

  for (const promo of enabledPromos) {
    if (promo.tier === currentTier && currentTier !== "NONE") {
      // This promo matches the current tier - skip, we'll handle it below
      continue;
    }
    // Disable this promo (wrong tier or tier is NONE)
    if (promo.promoId) {
      try {
        await bc().updatePromotion(promo.promoId, { status: "DISABLED" });
      } catch (err) {
        console.warn(`Failed to disable promo ${promo.promoId}:`, err);
      }
    }
    await db.promotionRecord.update({
      where: { id: promo.id },
      data: { enabled: false, disabledAt: new Date() },
    });
  }

  // If tier is NONE, no promotion needed
  if (currentTier === "NONE") return;

  // Find or create the promotion record for this tier
  let promoRecord = await db.promotionRecord.findUnique({
    where: { accountId_tier: { accountId, tier: currentTier } },
  });

  const tierConfig = await getTierConfig(currentTier);
  if (!tierConfig) return;

  if (!promoRecord) {
    // Create a new coupon code
    const code = currentTier === "WELCOME"
      ? formatCouponCode(alias, tierConfig.discount).replace(`T${tierConfig.discount}`, "WELCOME")
      : formatCouponCode(alias, tierConfig.discount);

    promoRecord = await db.promotionRecord.create({
      data: {
        accountId,
        tier: currentTier,
        code,
        enabled: false,
      },
    });
  }

  // If already enabled with a valid BC promo, nothing to do
  if (promoRecord.enabled && promoRecord.promoId) {
    return;
  }

  // Create or enable the BigCommerce promotion
  if (promoRecord.promoId) {
    // Re-enable existing promotion
    try {
      await bc().updatePromotion(promoRecord.promoId, { status: "ENABLED" });
      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: { enabled: true, disabledAt: null },
      });
    } catch (err) {
      console.error(`Failed to enable promo ${promoRecord.promoId}:`, err);
      // Still mark as enabled locally so coupon code is visible on dashboard
      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: { enabled: true, disabledAt: null },
      });
    }
  } else {
    // Create new BC promotion
    try {
      const bcPromo = await bc().createPromotion({
        name: `Wholesale ${promoRecord.code}`,
        redemption_type: "COUPON",
        status: "ENABLED",
        can_be_used_with_other_promotions: false,
        rules: [
          {
            action: {
              cart_items: {
                discount: {
                  percentage_amount: tierConfig.discount.toString(),
                },
              },
            },
            apply_once: true,
            stop: true,
          },
          {
            action: {
              shipping: {
                free_shipping: true,
                zone_ids: "*",
              },
            },
            apply_once: true,
            stop: false,
          },
        ],
        notifications: [],
        currency_code: "USD",
      });

      const promoId = (bcPromo.data as { id: number }).id;

      // Create coupon code
      await bc().createCouponCode(promoId, promoRecord.code);

      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: {
          promoId,
          enabled: true,
          disabledAt: null,
        },
      });
    } catch (err) {
      console.error("Failed to create BC promotion:", err);
      // Still mark as enabled locally so the coupon code is visible on the dashboard.
      // The next recalc will retry BC promotion creation.
      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: { enabled: true, disabledAt: null },
      });
    }
  }
}

/**
 * Handle promotion enable/disable when tier changes.
 * @deprecated Use ensurePromoForTier instead. Kept for backwards compatibility.
 */
export async function handleTierChange(
  accountId: string,
  alias: string,
  _oldTier: TierId,
  newTier: TierId
): Promise<void> {
  await ensurePromoForTier(accountId, alias, newTier);
}

/**
 * Recalculate tiers for ALL approved wholesale accounts.
 * Called by the cron job.
 */
export async function recalcAllTiers(): Promise<{
  processed: number;
  changed: number;
  errors: number;
}> {
  const accounts = await db.wholesaleAccount.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });

  let processed = 0;
  let changed = 0;
  let errors = 0;

  for (const account of accounts) {
    try {
      const result = await recalcTier(account.id);
      processed++;
      if (result.changed) changed++;
    } catch (err) {
      errors++;
      console.error(`Tier recalc failed for ${account.id}:`, err);
    }
  }

  return { processed, changed, errors };
}
