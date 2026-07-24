import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import {
  buildPublisherCouponPromotionBody,
  formatPublisherCouponCode,
  PUBLISHER_PROMO_KIND,
} from "@/lib/bigcommerce/publisher-promotions";
import { sendPublisherTierChangedEmail } from "@/lib/email";
import { QUALIFYING_TIER_STATUS_IDS, type TierDef } from "@/lib/tier-engine";

export const DEFAULT_PUBLISHER_TIER_WINDOW_DAYS = 14;
export const DEFAULT_PUBLISHER_TIERS: TierDef[] = [
  { id: "P15", label: "15% Audience", minOrders: 0, discount: 15 },
  { id: "P20", label: "20% Audience", minOrders: 50, discount: 20 },
  { id: "P25", label: "25% Audience", minOrders: 125, discount: 25 },
];

export function publisherTierFromCount(
  count: number,
  tiers: TierDef[] = DEFAULT_PUBLISHER_TIERS
): string {
  const valid = tiers
    .filter((tier) => tier.id.startsWith("P") && tier.minOrders >= 0)
    .sort((a, b) => b.minOrders - a.minOrders);
  return valid.find((tier) => count >= tier.minOrders)?.id ?? "P15";
}

export async function loadPublisherTierConfig(): Promise<{
  tiers: TierDef[];
  windowDays: number;
}> {
  try {
    const row = await db.globalSettings.findUnique({ where: { id: "global" } });
    const settings = row?.settings as Record<string, unknown> | null;
    const tiers =
      Array.isArray(settings?.publisherTiers) && settings.publisherTiers.length
        ? (settings.publisherTiers as TierDef[])
        : DEFAULT_PUBLISHER_TIERS;
    const configuredDays = Number(settings?.publisherTierWindowDays);
    return {
      tiers: [...tiers].sort((a, b) => a.minOrders - b.minOrders),
      windowDays:
        Number.isInteger(configuredDays) && configuredDays >= 1 && configuredDays <= 90
          ? configuredDays
          : DEFAULT_PUBLISHER_TIER_WINDOW_DAYS,
    };
  } catch {
    return {
      tiers: [...DEFAULT_PUBLISHER_TIERS],
      windowDays: DEFAULT_PUBLISHER_TIER_WINDOW_DAYS,
    };
  }
}

export async function savePublisherTierConfig(
  tiers: TierDef[],
  windowDays: number
): Promise<void> {
  const row = await db.globalSettings.findUnique({ where: { id: "global" } });
  const existing = (row?.settings as Record<string, unknown>) || {};
  const settings = JSON.parse(
    JSON.stringify({
      ...existing,
      publisherTiers: tiers,
      publisherTierWindowDays: windowDays,
    })
  ) as Prisma.InputJsonValue;
  await db.globalSettings.upsert({
    where: { id: "global" },
    create: { id: "global", settings },
    update: { settings },
  });
}

export async function ensurePublisherPromoForTier(
  accountId: string,
  alias: string,
  tier: string,
  options: { rotate?: boolean } = {}
): Promise<{ code: string; discount: number }> {
  const { tiers } = await loadPublisherTierConfig();
  const config = tiers.find((item) => item.id === tier) ?? tiers.find((item) => item.id === "P15");
  if (!config) throw new Error("Publisher P15 tier is not configured");

  const enabled = await db.promotionRecord.findMany({
    where: { accountId, promoKind: PUBLISHER_PROMO_KIND, enabled: true },
  });
  for (const promo of enabled) {
    // Reuse a successfully created target-tier promo. This makes retries after
    // an email/DB failure idempotent instead of rotating the fresh code again.
    if (promo.tier === config.id && promo.promoId) {
      return { code: promo.code, discount: config.discount };
    }
    if (promo.promoId) {
      // Never activate a replacement while the public old code may still work.
      await bc().updatePromotion(promo.promoId, { status: "DISABLED" });
    }
    await db.promotionRecord.update({
      where: { id: promo.id },
      data: { enabled: false, disabledAt: new Date() },
    });
  }

  let record = await db.promotionRecord.findFirst({
    where: { accountId, tier: config.id, promoKind: PUBLISHER_PROMO_KIND },
  });
  const code =
    record && !options.rotate
      ? record.code
      : formatPublisherCouponCode(alias, config.id);
  if (record) {
    record = await db.promotionRecord.update({
      where: { id: record.id },
      data: { code, promoId: null, enabled: false, disabledAt: null },
    });
  } else {
    record = await db.promotionRecord.create({
      data: {
        accountId,
        tier: config.id,
        promoKind: PUBLISHER_PROMO_KIND,
        code,
        enabled: false,
      },
    });
  }

  try {
    const promotion = await bc().createPromotion(
      buildPublisherCouponPromotionBody({
        code,
        discountPercent: config.discount,
      })
    );
    const promoId = (promotion.data as { id: number }).id;
    await bc().createCouponCode(promoId, code);
    await db.promotionRecord.update({
      where: { id: record.id },
      data: { promoId, enabled: true, disabledAt: null },
    });
  } catch (error) {
    console.error(`Failed to create publisher promotion for ${accountId}:`, error);
    // Keep the generated code retryable; never approve or notify a publisher
    // with a coupon that BigCommerce did not create.
    await db.promotionRecord.update({
      where: { id: record.id },
      data: { enabled: false, disabledAt: null },
    });
    throw error;
  }

  return { code, discount: config.discount };
}

export async function attributePublisherOrder(order: BCOrder): Promise<{
  attributed: boolean;
  accountId?: string;
}> {
  if (!QUALIFYING_TIER_STATUS_IDS.includes(order.status_id)) {
    const existing = await db.publisherOrderAttribution.findUnique({
      where: { orderId: order.id },
      select: { accountId: true },
    });
    if (!existing) return { attributed: false };
    await db.publisherOrderAttribution.delete({ where: { orderId: order.id } });
    return { attributed: false, accountId: existing.accountId };
  }

  const coupons = await bc().getOrderCouponsStrict(order.id);
  if (!coupons.length) return { attributed: false };

  const codes = coupons.map((coupon) => coupon.code.trim().toUpperCase());
  const promo = await db.promotionRecord.findFirst({
    where: {
      promoKind: PUBLISHER_PROMO_KIND,
      code: { in: codes, mode: "insensitive" },
      account: { partnerType: "AFFILIATE_PUBLISHER", status: "APPROVED" },
    },
    select: { accountId: true, code: true },
  });
  if (!promo) return { attributed: false };

  const attributed = await recordPublisherAttribution({
    accountId: promo.accountId,
    orderId: order.id,
    couponCode: promo.code,
    orderDate: new Date(order.date_created),
    subtotal: order.total_ex_tax ? new Prisma.Decimal(order.total_ex_tax) : null,
  });
  return { attributed, accountId: promo.accountId };
}

export async function recordPublisherAttribution(data: {
  accountId: string;
  orderId: number;
  couponCode: string;
  orderDate: Date;
  subtotal: Prisma.Decimal | null;
}): Promise<boolean> {
  const result = await db.publisherOrderAttribution.createMany({
    data: [{
      ...data,
    }],
    skipDuplicates: true,
  });
  return result.count === 1;
}

export async function recalcPublisherTier(
  accountId: string,
  options: { windowDays?: number; ignorePausedUpgrades?: boolean } = {}
): Promise<{
  previousTier: string;
  newTier: string;
  count14d: number;
  changed: boolean;
  windowDays: number;
}> {
  return withPublisherTierLock(accountId, () =>
    recalcPublisherTierLocked(accountId, options)
  );
}

export async function withPublisherTierLock<T>(
  accountId: string,
  action: () => Promise<T>
): Promise<T> {
  // Serialize rotations across concurrent webhook and admin invocations.
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('publisher-tier'),
          hashtext(${accountId})
        )
      `;
      return action();
    },
    { maxWait: 5_000, timeout: 30_000 }
  );
}

async function recalcPublisherTierLocked(
  accountId: string,
  options: { windowDays?: number; ignorePausedUpgrades?: boolean } = {}
): Promise<{
  previousTier: string;
  newTier: string;
  count14d: number;
  changed: boolean;
  windowDays: number;
}> {
  const account = await db.wholesaleAccount.findUnique({ where: { id: accountId } });
  const config = await loadPublisherTierConfig();
  const windowDays = options.windowDays ?? config.windowDays;
  if (
    !account ||
    account.status !== "APPROVED" ||
    account.partnerType !== "AFFILIATE_PUBLISHER"
  ) {
    return { previousTier: "P15", newTier: "P15", count14d: 0, changed: false, windowDays };
  }

  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const count14d = await db.publisherOrderAttribution.count({
    where: { accountId, orderDate: { gte: windowStart } },
  });
  const previousTier = account.lastTier.startsWith("P") ? account.lastTier : "P15";
  const calculatedTier = publisherTierFromCount(count14d, config.tiers);
  const newTier =
    account.pausedUpgrades && !options.ignorePausedUpgrades ? previousTier : calculatedTier;
  const changed = newTier !== previousTier;

  // Complete the external rotation before publishing the new tier in the DB.
  // If BC fails, the old tier/code remains authoritative and the webhook retries.
  const promotion = await ensurePublisherPromoForTier(accountId, account.alias, newTier, {
    rotate: changed,
  });

  if (changed) {
    // Email before publishing lastTier. If delivery fails, webhook retry sees the
    // old tier and retries the notification without creating another promotion.
    await sendPublisherTierChangedEmail(
      account.email,
      account.companyName,
      previousTier,
      newTier,
      count14d,
      promotion.code,
      promotion.discount
    );
  }

  await db.wholesaleAccount.update({
    where: { id: accountId },
    data: {
      lastTier: newTier,
      lastCount14d: count14d,
      welcomeExpiresAt: null,
    },
  });

  if (changed) {
    await db.auditLog.create({
      data: {
        actorEmail: "system",
        action: "publisher_tier_changed",
        targetAccountId: accountId,
        details: {
          from: previousTier,
          to: newTier,
          count14d,
          windowDays,
          code: promotion.code,
        },
      },
    });
  }

  return { previousTier, newTier, count14d, changed, windowDays };
}

export async function recalcAllPublisherTiers(): Promise<{
  processed: number;
  changed: number;
  errors: number;
  windowDays: number;
}> {
  const { windowDays } = await loadPublisherTierConfig();
  const accounts = await db.wholesaleAccount.findMany({
    where: { status: "APPROVED", partnerType: "AFFILIATE_PUBLISHER" },
    select: { id: true },
  });
  let changed = 0;
  let errors = 0;
  for (const account of accounts) {
    try {
      const result = await recalcPublisherTier(account.id, { windowDays });
      if (result.changed) changed++;
    } catch (error) {
      errors++;
      console.error(`Publisher tier recalc failed for ${account.id}:`, error);
    }
  }
  return { processed: accounts.length, changed, errors, windowDays };
}
