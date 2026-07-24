import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { bc, type BCOrder, type BCOrderProduct } from "@/lib/bigcommerce/client";
import { loadTiers, QUALIFYING_TIER_STATUS_IDS } from "@/lib/tier-engine";

/**
 * Risk detection engine.
 *
 * Detects three types of suspicious behavior:
 * 1. rapid_low_value — Many small orders placed quickly (order farming)
 * 2. same_sku_farming — Same SKU ordered repeatedly in separate orders
 * 3. tier_chasing — Burst of orders right before tier threshold
 */

interface RiskCheck {
  type: string;
  detected: boolean;
  details: Record<string, unknown>;
}

/**
 * Run all risk checks for a single wholesale account.
 */
export async function runRiskChecks(accountId: string): Promise<RiskCheck[]> {
  const account = await db.wholesaleAccount.findUnique({
    where: { id: accountId },
  });

  if (
    !account ||
    account.partnerType !== "DROPSHIPPER" ||
    !account.customerId ||
    account.status !== "APPROVED"
  ) {
    return [];
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const minDate = sevenDaysAgo.toISOString().replace("T", " ").replace("Z", "");

  // Fetch recent orders
  let orders: BCOrder[] = [];
  try {
    let page = 1;
    while (true) {
      const pageOrders = await bc().getOrders({
        customer_id: account.customerId,
        min_date_created: minDate,
        limit: 250,
        page,
      });
      if (!pageOrders || pageOrders.length === 0) break;
      orders = orders.concat(pageOrders);
      if (pageOrders.length < 250) break;
      page++;
    }
  } catch (err) {
    console.error(`Risk check order fetch failed for ${accountId}:`, err);
    return [];
  }

  // Only count qualifying order statuses (consistent with tier engine)
  orders = orders.filter((o) => QUALIFYING_TIER_STATUS_IDS.includes(o.status_id));

  const results: RiskCheck[] = [];

  // 1. Rapid Low-Value Check
  const rapidLowValue = checkRapidLowValue(orders);
  results.push(rapidLowValue);

  // 2. Same SKU Farming Check (requires product data)
  const skuFarming = await checkSameSkuFarming(orders);
  results.push(skuFarming);

  // 3. Tier Chasing Check
  const tiers = await loadTiers();
  const tierChasing = checkTierChasing(orders, account.lastTier, tiers.map((t) => t.minOrders));
  results.push(tierChasing);

  // Create risk flags for detected issues
  for (const check of results) {
    if (check.detected) {
      // Don't duplicate existing open flags of the same type
      const existing = await db.riskFlag.findFirst({
        where: {
          accountId,
          type: check.type,
          status: "OPEN",
        },
      });

      if (!existing) {
        await db.riskFlag.create({
          data: {
            accountId,
            type: check.type,
            details: check.details as Prisma.InputJsonValue,
            status: "OPEN",
          },
        });

        await db.auditLog.create({
          data: {
            actorEmail: "system",
            action: "risk_flag_created",
            targetAccountId: accountId,
            targetCustomerId: account.customerId,
            details: check as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  return results;
}

export const PUBLISHER_BURST_THRESHOLD_PER_HOUR = 20;

export function checkPublisherRedemptionBurst(
  orderDates: Date[],
  now = new Date()
): RiskCheck {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const ordersLastHour = orderDates.filter(
    (date) => date >= oneHourAgo && date <= now
  ).length;
  return {
    type: "publisher_redemption_burst",
    detected: ordersLastHour > PUBLISHER_BURST_THRESHOLD_PER_HOUR,
    details: {
      ordersLastHour,
      threshold: PUBLISHER_BURST_THRESHOLD_PER_HOUR,
      sharingAllowed: true,
    },
  };
}

export async function runPublisherBurstRiskCheck(accountId: string): Promise<RiskCheck[]> {
  const account = await db.wholesaleAccount.findUnique({ where: { id: accountId } });
  if (
    !account ||
    account.status !== "APPROVED" ||
    account.partnerType !== "AFFILIATE_PUBLISHER"
  ) {
    return [];
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const orders = await db.publisherOrderAttribution.findMany({
    where: { accountId, orderDate: { gte: oneHourAgo } },
    select: { orderDate: true, couponCode: true },
  });
  const check = checkPublisherRedemptionBurst(orders.map((order) => order.orderDate));
  if (check.detected) {
    const existing = await db.riskFlag.findFirst({
      where: { accountId, type: check.type, status: "OPEN" },
      select: { id: true },
    });
    if (!existing) {
      await db.riskFlag.create({
        data: {
          accountId,
          type: check.type,
          details: {
            ...check.details,
            couponCodes: [...new Set(orders.map((order) => order.couponCode))],
          } as Prisma.InputJsonValue,
        },
      });
    }
  }
  return [check];
}

/**
 * Check 1: Rapid Low-Value Orders
 * Flag if >10 orders under $10 each within 7 days
 */
function checkRapidLowValue(orders: BCOrder[]): RiskCheck {
  const lowValueOrders = orders.filter(
    (o) => parseFloat(o.total_ex_tax) < 10
  );

  const detected = lowValueOrders.length > 10;

  return {
    type: "rapid_low_value",
    detected,
    details: {
      totalOrders: orders.length,
      lowValueCount: lowValueOrders.length,
      threshold: 10,
      avgOrderValue:
        orders.length > 0
          ? (
              orders.reduce((sum, o) => sum + parseFloat(o.total_ex_tax), 0) /
              orders.length
            ).toFixed(2)
          : "0",
    },
  };
}

/**
 * Check 2: Same SKU Farming
 * Flag if any single SKU appears in >5 separate orders
 */
async function checkSameSkuFarming(orders: BCOrder[]): Promise<RiskCheck> {
  const skuCountMap = new Map<string, number>();

  // Sample up to 20 orders to avoid API rate limits
  const sample = orders.slice(0, 20);

  for (const order of sample) {
    try {
      const products: BCOrderProduct[] = await bc().getOrderProducts(order.id);
      const seenSkus = new Set<string>();

      for (const p of products) {
        if (p.sku && !seenSkus.has(p.sku)) {
          seenSkus.add(p.sku);
          skuCountMap.set(p.sku, (skuCountMap.get(p.sku) || 0) + 1);
        }
      }
    } catch {
      // Skip if can't fetch products
    }
  }

  const flaggedSkus = Array.from(skuCountMap.entries())
    .filter(([, count]) => count > 5)
    .map(([sku, count]) => ({ sku, orderCount: count }));

  return {
    type: "same_sku_farming",
    detected: flaggedSkus.length > 0,
    details: {
      ordersChecked: sample.length,
      flaggedSkus,
      threshold: 5,
    },
  };
}

/**
 * Check 3: Tier Chasing
 * Flag if order count is within 3 of a tier threshold and orders are clustered
 * in the last 24 hours
 */
function checkTierChasing(
  orders: BCOrder[],
  currentTier: string,
  tierThresholds: number[]
): RiskCheck {
  const thresholds = tierThresholds.filter((t) => t > 0);
  const count = orders.length;

  // Check if count is just below or at a threshold
  const nearThreshold = thresholds.some(
    (t) => count >= t - 3 && count <= t + 2
  );

  // Check if many orders were placed in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentOrders = orders.filter(
    (o) => new Date(o.date_created) > oneDayAgo
  );
  const recentBurst = recentOrders.length > 10;

  const detected = nearThreshold && recentBurst;

  return {
    type: "tier_chasing",
    detected,
    details: {
      totalOrders7d: count,
      ordersLast24h: recentOrders.length,
      currentTier,
      nearThreshold,
      burstDetected: recentBurst,
    },
  };
}

/**
 * Run risk checks for all approved accounts.
 */
export async function runAllRiskChecks(): Promise<{
  processed: number;
  flagsCreated: number;
  errors: number;
}> {
  const accounts = await db.wholesaleAccount.findMany({
    where: { status: "APPROVED" },
    select: { id: true, partnerType: true },
  });

  let processed = 0;
  let flagsCreated = 0;
  let errors = 0;

  for (const account of accounts) {
    try {
      const checks =
        account.partnerType === "AFFILIATE_PUBLISHER"
          ? await runPublisherBurstRiskCheck(account.id)
          : await runRiskChecks(account.id);
      processed++;
      flagsCreated += checks.filter((c) => c.detected).length;
    } catch (err) {
      errors++;
      console.error(`Risk checks failed for ${account.id}:`, err);
    }
  }

  return { processed, flagsCreated, errors };
}
