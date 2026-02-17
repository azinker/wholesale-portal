import { bc, type BCPromotion } from "@/lib/bigcommerce/client";
import { db } from "@/lib/db";

/**
 * Promo Audit Tool
 *
 * Scans all BigCommerce promotions to detect retail-facing promos
 * that are NOT excluded for wholesale customer groups.
 *
 * This prevents wholesale customers from stacking a retail sale
 * (e.g., "20% OFF SITEWIDE") on top of their wholesale discount.
 */

export interface PromoAuditResult {
  totalPromotions: number;
  flaggedPromotions: {
    id: number;
    name: string;
    status: string;
    reason: string;
  }[];
}

export async function runPromoAudit(): Promise<PromoAuditResult> {
  // Fetch all promotions
  const { data: promotions } = await bc().getPromotions();

  // Get the wholesale customer group names we manage
  const wholesaleAccounts = await db.wholesaleAccount.findMany({
    where: { status: "APPROVED" },
    select: { alias: true },
  });

  // Also fetch customer groups to find our "Wholesale" group
  let wholesaleGroupId: number | null = null;
  try {
    const group = await bc().getCustomerGroupByName("Wholesale");
    if (group) wholesaleGroupId = group.id;
  } catch {
    // No wholesale group found
  }

  const flagged: PromoAuditResult["flaggedPromotions"] = [];

  // Get our managed promotion IDs
  const managedPromoIds = new Set(
    (
      await db.promotionRecord.findMany({
        select: { promoId: true },
        where: { promoId: { not: null } },
      })
    ).map((p) => p.promoId)
  );

  for (const promo of promotions) {
    // Skip our own managed wholesale promotions
    if (managedPromoIds.has(promo.id)) continue;

    // Skip disabled promotions
    if (promo.status !== "enabled") continue;

    // Check if this promotion has any customer group restriction
    const rules = promo.rules as Array<Record<string, unknown>>;
    let hasGroupExclusion = false;

    for (const rule of rules || []) {
      const conditions = rule.conditions as Record<string, unknown> | undefined;
      if (!conditions) continue;

      // Look for customer conditions that exclude the wholesale group
      const customerCondition = conditions.customer as Record<string, unknown> | undefined;
      if (customerCondition) {
        const segments = customerCondition.segments as Record<string, unknown> | undefined;
        const groups = customerCondition.customer_groups as Array<number> | undefined;

        if (groups && wholesaleGroupId && !groups.includes(wholesaleGroupId)) {
          hasGroupExclusion = true;
        }
      }
    }

    // Flag if it's an active retail promo with no wholesale exclusion
    if (!hasGroupExclusion) {
      flagged.push({
        id: promo.id,
        name: promo.name,
        status: promo.status,
        reason: wholesaleGroupId
          ? `Active retail promotion not excluding Wholesale group (#${wholesaleGroupId})`
          : "Active retail promotion (no Wholesale customer group exists to exclude)",
      });
    }
  }

  return {
    totalPromotions: promotions.length,
    flaggedPromotions: flagged,
  };
}
