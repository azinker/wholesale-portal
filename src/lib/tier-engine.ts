import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import { formatCouponCode, toAlias } from "@/lib/utils";
import {
  sendCouponChangedEmail,
  sendCouponCreatedEmail,
  sendCouponDisabledEmail,
  sendTierChangedEmail,
  sendWelcomeDiscountExpiringEmail,
} from "@/lib/email";
import {
  DEFAULT_TIER_WINDOW_DAYS,
  getTierWindowStartDate,
  normalizeTierWindowDays,
} from "@/lib/tier-window";
import {
  buildWholesaleCouponPromotionBody,
  getWholesaleCustomerGroupId,
  syncWholesalePromotionEligibility,
} from "@/lib/bigcommerce/wholesale-promotions";

// ── Tier types ──────────────────────────────────────────
export interface TierDef {
  id: string;       // e.g. "T10", "T15", "T20"
  label: string;    // e.g. "10% Off"
  minOrders: number;
  discount: number; // percentage
}

/** TierId is now a plain string ("NONE" | "T10" | "T15" | …) */
export type TierId = string;

// Qualifying status IDs for rolling-window tier count (must match recalcTier logic)
export const QUALIFYING_TIER_STATUS_IDS = [2, 3, 10, 14, 11];

/**
 * Returns whether an order counts toward the current rolling tier window, has expired from
 * that window, or never counted (wrong status).
 */
export function getTierStatusForOrder(
  dateCreated: string,
  statusId: number,
  windowDays: number = DEFAULT_TIER_WINDOW_DAYS
): "counts" | "expired" | "excluded" {
  if (!QUALIFYING_TIER_STATUS_IDS.includes(statusId)) return "excluded";
  const orderDate = new Date(dateCreated);
  const windowStart = getTierWindowStartDate(windowDays);
  return orderDate >= windowStart ? "counts" : "expired";
}

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

/** Load rolling window length (days) for tier calculations from GlobalSettings */
export async function loadTierWindowDays(): Promise<number> {
  try {
    const row = await db.globalSettings.findUnique({ where: { id: "global" } });
    const settings = row?.settings as Record<string, unknown> | null;
    return normalizeTierWindowDays(settings?.tierWindowDays, DEFAULT_TIER_WINDOW_DAYS);
  } catch {
    return DEFAULT_TIER_WINDOW_DAYS;
  }
}

/** Save rolling window length (days) for tier calculations to GlobalSettings */
export async function saveTierWindowDays(windowDays: number): Promise<void> {
  const normalized = normalizeTierWindowDays(windowDays, DEFAULT_TIER_WINDOW_DAYS);
  const row = await db.globalSettings.findUnique({ where: { id: "global" } });
  const existingSettings = (row?.settings as Record<string, unknown>) || {};
  const merged = JSON.parse(
    JSON.stringify({ ...existingSettings, tierWindowDays: normalized })
  ) as Prisma.InputJsonValue;
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

/** Determine the tier from the current rolling-window order count (async, reads DB) */
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

/** Discount percentage for a tier ID (includes WELCOME). */
export async function getTierDiscountPercent(tierId: TierId): Promise<number> {
  const config = await getTierConfig(tierId);
  return config?.discount ?? 0;
}

/**
 * Recalculate tier for a single wholesale account.
 *
 * Steps:
 * 1. Fetch paid orders from BC in the configured rolling window for this customer
 * 2. Filter to US-only orders with at least 1 shipment
 * 3. Count qualifying orders
 * 4. Determine new tier
 * 5. If tier changed → create/enable/disable promotions as needed
 * 6. Save snapshot + update account
 */
export async function recalcTier(
  accountId: string,
  options: { windowDays?: number; ignorePausedUpgrades?: boolean } = {}
): Promise<{
  previousTier: TierId;
  newTier: TierId;
  count7d: number;
  changed: boolean;
  windowDays: number;
}> {
  const configuredWindowDays = options.windowDays ?? await loadTierWindowDays();
  const windowDays = normalizeTierWindowDays(
    configuredWindowDays,
    DEFAULT_TIER_WINDOW_DAYS
  );
  const account = await db.wholesaleAccount.findUnique({
    where: { id: accountId },
    include: { promotions: true },
  });

  if (!account || account.status !== "APPROVED" || !account.customerId) {
    return {
      previousTier: "NONE",
      newTier: "NONE",
      count7d: 0,
      changed: false,
      windowDays,
    };
  }

  if (account.pausedUpgrades && !options.ignorePausedUpgrades) {
    // Tier is locked by admin — don't change it, but still ensure the
    // promotion exists (retries BC API if a previous attempt failed).
    await ensurePromoForTier(account.id, account.alias, account.lastTier as TierId);
    return {
      previousTier: account.lastTier as TierId,
      newTier: account.lastTier as TierId,
      count7d: account.lastCount7d,
      changed: false,
      windowDays,
    };
  }

  const previousTier = account.lastTier as TierId;

  // Fetch orders from the configured rolling window
  const minDate = getTierWindowStartDate(windowDays)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");

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

  // Qualifying orders: paid orders that are shipped or awaiting fulfillment (see QUALIFYING_TIER_STATUS_IDS).
  const qualifyingCount = allOrders.filter((o) =>
    QUALIFYING_TIER_STATUS_IDS.includes(o.status_id)
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

  // Update the account first so portal counts stay current even if later
  // steps (snapshot write, promo sync) are interrupted on serverless.
  await db.wholesaleAccount.update({
    where: { id: account.id },
    data: {
      lastTier: newTier,
      lastCount7d: qualifyingCount,
      // Once earned tier is equal/higher (or welcome has ended), clear welcome expiry
      // so welcome messaging no longer appears.
      welcomeExpiresAt: account.welcomeExpiresAt && newTier !== "WELCOME"
        ? null
        : undefined,
    },
  });

  // Save tier snapshot (audit trail; non-critical for portal display)
  await db.tierSnapshot.create({
    data: {
      accountId: account.id,
      asOf: new Date(),
      paidOrders7d: qualifyingCount,
      tierLevel: newTier,
      activeCode: account.promotions.find((p) => p.enabled)?.code || null,
    },
  });

  // Retain last 30 snapshots per account
  const staleSnapshots = await db.tierSnapshot.findMany({
    where: { accountId: account.id },
    orderBy: { asOf: "desc" },
    skip: 30,
    select: { id: true },
  });
  if (staleSnapshots.length > 0) {
    await db.tierSnapshot.deleteMany({
      where: { id: { in: staleSnapshots.map((s) => s.id) } },
    });
  }

  // Always ensure the correct promotion is active for the current tier.
  // This handles: tier changes, retries after failed BC API calls, and
  // ensuring a promotion exists even if the tier hasn't changed.
  await ensurePromoForTier(account.id, account.alias, newTier);

  if (changed) {
    const previousConfig = await getTierConfig(previousTier);
    const newConfig = await getTierConfig(newTier);
    const previousDiscount = previousConfig?.discount ?? 0;
    const newDiscount = newConfig?.discount ?? 0;
    const changeType = newDiscount >= previousDiscount ? "achieved" : "downgraded";

    await sendTierChangedEmail(
      account.email,
      account.companyName,
      previousTier,
      newTier,
      qualifyingCount,
      windowDays,
      changeType
    );

    if (previousTier !== "NONE" && newTier !== "NONE" && newConfig) {
      const activePromo = await db.promotionRecord.findFirst({
        where: { accountId: account.id, enabled: true, tier: newTier },
        select: { code: true },
      });
      if (activePromo) {
        await sendCouponChangedEmail(
          account.email,
          account.companyName,
          previousTier,
          newTier,
          activePromo.code,
          newConfig.discount
        );
      }
    }

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
          windowDays,
        },
      },
    });
  }

  await maybeSendWelcomeExpiringEmail(account.id, account.email, account.companyName, account.welcomeExpiresAt, newTier);

  return { previousTier, newTier, count7d: qualifyingCount, changed, windowDays };
}

async function maybeSendWelcomeExpiringEmail(
  accountId: string,
  email: string,
  companyName: string,
  welcomeExpiresAt: Date | null,
  currentTier: TierId
): Promise<void> {
  if (!welcomeExpiresAt || currentTier !== "WELCOME") return;

  const msUntilExpiry = welcomeExpiresAt.getTime() - Date.now();
  const reminderWindowMs = 24 * 60 * 60 * 1000;
  if (msUntilExpiry <= 0 || msUntilExpiry > reminderWindowMs) return;

  const alreadySent = await db.auditLog.findFirst({
    where: {
      action: "welcome_expiring_email_sent",
      targetAccountId: accountId,
      createdAt: { gte: new Date(Date.now() - reminderWindowMs) },
    },
    select: { id: true },
  });
  if (alreadySent) return;

  const welcomeConfig = await loadWelcomeConfig();
  await sendWelcomeDiscountExpiringEmail(email, companyName, welcomeExpiresAt, welcomeConfig.discount);
  await db.auditLog.create({
    data: {
      actorEmail: "system",
      action: "welcome_expiring_email_sent",
      targetAccountId: accountId,
      details: {
        expiresAt: welcomeExpiresAt.toISOString(),
        discount: welcomeConfig.discount,
      },
    },
  });
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
  const account = await db.wholesaleAccount.findUnique({
    where: { id: accountId },
    select: { email: true, companyName: true },
  });

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

    if (currentTier === "NONE" && account) {
      await sendCouponDisabledEmail(
        account.email,
        account.companyName,
        promo.code,
        "Your current order volume does not qualify for an active wholesale coupon."
      );
    }
  }

  // If tier is NONE, no promotion needed
  if (currentTier === "NONE") return;

  // Find or create the promotion record for this tier
  let promoRecord = await db.promotionRecord.findUnique({
    where: { accountId_tier: { accountId, tier: currentTier } },
  });
  let createdRecord = false;

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
    createdRecord = true;
  }

  const wholesaleGroupId = await getWholesaleCustomerGroupId();
  if (!wholesaleGroupId) {
    console.error(
      `Cannot create or sync wholesale promotion for ${accountId}: Wholesale customer group not found`
    );
    return;
  }

  // Keep legacy promotions restricted to logged-in Wholesale customers.
  if (promoRecord.enabled && promoRecord.promoId) {
    try {
      await syncWholesalePromotionEligibility(promoRecord.promoId, wholesaleGroupId);
    } catch (err) {
      console.warn(
        `Failed to sync Wholesale eligibility for promo ${promoRecord.promoId}:`,
        err
      );
    }
    return;
  }

  // Create or enable the BigCommerce promotion
  if (promoRecord.promoId) {
    // Re-enable existing promotion
    try {
      await bc().updatePromotion(promoRecord.promoId, {
        status: "ENABLED",
        customer: { group_ids: [wholesaleGroupId] },
      });
      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: { enabled: true, disabledAt: null },
      });
      if (createdRecord && account) {
        await sendCouponCreatedEmail(account.email, account.companyName, promoRecord.code, currentTier, tierConfig.discount);
      }
    } catch (err) {
      console.error(`Failed to enable promo ${promoRecord.promoId}:`, err);
      // Still mark as enabled locally so coupon code is visible on dashboard
      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: { enabled: true, disabledAt: null },
      });
      if (createdRecord && account) {
        await sendCouponCreatedEmail(account.email, account.companyName, promoRecord.code, currentTier, tierConfig.discount);
      }
    }
  } else {
    // Create new BC promotion
    try {
      const bcPromo = await bc().createPromotion(
        buildWholesaleCouponPromotionBody({
          code: promoRecord.code,
          discountPercent: tierConfig.discount,
          wholesaleGroupId,
        })
      );

      const promoId = (bcPromo.data as { id: number }).id;

      // Create coupon code (retry with new code if duplicate)
      let codeToUse = promoRecord.code;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await bc().createCouponCode(promoId, codeToUse);
          break;
        } catch (codeErr) {
          if (attempt === 0) {
            // Likely duplicate code in BC — generate a new one and retry
            codeToUse = currentTier === "WELCOME"
              ? formatCouponCode(alias, tierConfig.discount).replace(`T${tierConfig.discount}`, "WELCOME")
              : formatCouponCode(alias, tierConfig.discount);
            await db.promotionRecord.update({
              where: { id: promoRecord.id },
              data: { code: codeToUse },
            });
          } else {
            throw codeErr;
          }
        }
      }

      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: {
          promoId,
          enabled: true,
          disabledAt: null,
        },
      });
      if (createdRecord && account) {
        await sendCouponCreatedEmail(account.email, account.companyName, codeToUse, currentTier, tierConfig.discount);
      }
    } catch (err) {
      console.error("Failed to create BC promotion:", err);
      // Still mark as enabled locally so the coupon code is visible on the dashboard.
      // The next recalc will retry BC promotion creation.
      await db.promotionRecord.update({
        where: { id: promoRecord.id },
        data: { enabled: true, disabledAt: null },
      });
      if (createdRecord && account) {
        await sendCouponCreatedEmail(account.email, account.companyName, promoRecord.code, currentTier, tierConfig.discount);
      }
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
 * Repair wholesale accounts whose last_count_7d / last_tier drifted behind
 * the latest tier snapshot (e.g. serverless timeout after snapshot write).
 */
export async function syncStaleAccountCountsFromSnapshots(): Promise<{
  synced: number;
  accounts: Array<{
    accountId: string;
    companyName: string;
    customerId: number | null;
    previousTier: TierId;
    previousCount: number;
    newTier: TierId;
    newCount: number;
  }>;
}> {
  const accounts = await db.wholesaleAccount.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      companyName: true,
      customerId: true,
      lastTier: true,
      lastCount7d: true,
      snapshots: {
        orderBy: { asOf: "desc" },
        take: 1,
        select: { tierLevel: true, paidOrders7d: true },
      },
    },
  });

  const repaired: Array<{
    accountId: string;
    companyName: string;
    customerId: number | null;
    previousTier: TierId;
    previousCount: number;
    newTier: TierId;
    newCount: number;
  }> = [];

  for (const account of accounts) {
    const snapshot = account.snapshots[0];
    if (!snapshot) continue;

    const snapshotTier = snapshot.tierLevel as TierId;
    if (
      snapshot.paidOrders7d === account.lastCount7d &&
      snapshotTier === account.lastTier
    ) {
      continue;
    }

    await db.wholesaleAccount.update({
      where: { id: account.id },
      data: {
        lastTier: snapshotTier,
        lastCount7d: snapshot.paidOrders7d,
      },
    });

    repaired.push({
      accountId: account.id,
      companyName: account.companyName,
      customerId: account.customerId,
      previousTier: account.lastTier as TierId,
      previousCount: account.lastCount7d,
      newTier: snapshotTier,
      newCount: snapshot.paidOrders7d,
    });
  }

  if (repaired.length > 0) {
    console.log(
      `Synced ${repaired.length} stale wholesale account count(s) from latest snapshots`
    );
  }

  return { synced: repaired.length, accounts: repaired };
}

/**
 * Recalculate tiers for ALL approved wholesale accounts.
 * Called by the cron job.
 */
export async function recalcAllTiers(): Promise<{
  processed: number;
  changed: number;
  errors: number;
  windowDays: number;
  staleSynced: number;
}> {
  const { synced: staleSynced } = await syncStaleAccountCountsFromSnapshots();
  const windowDays = await loadTierWindowDays();
  const accounts = await db.wholesaleAccount.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });

  let processed = 0;
  let changed = 0;
  let errors = 0;

  const CONCURRENCY = 5;
  for (let i = 0; i < accounts.length; i += CONCURRENCY) {
    const batch = accounts.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (account) => {
        try {
          const result = await recalcTier(account.id, { windowDays });
          return { ok: true as const, changed: result.changed };
        } catch (err) {
          console.error(`Tier recalc failed for ${account.id}:`, err);
          return { ok: false as const, changed: false };
        }
      })
    );
    for (const r of batchResults) {
      processed++;
      if (!r.ok) errors++;
      else if (r.changed) changed++;
    }
  }

  return { processed, changed, errors, windowDays, staleSynced };
}
