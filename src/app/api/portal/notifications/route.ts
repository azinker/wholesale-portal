import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadTierWindowDays, loadTiers, type TierId } from "@/lib/tier-engine";
import { formatTierWindowLabel } from "@/lib/tier-window";

export interface PortalNotification {
  id: string;
  type: "tier_progress" | "tier_achieved" | "info_change_approved" | "info_change_denied" | "info_change_pending" | "encouragement";
  title: string;
  message: string;
  variant: "info" | "success" | "warning" | "default";
  timestamp?: string;
}

/** GET: Compute notifications for the current portal user */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications: PortalNotification[] = [];
  const account = user.wholesaleAccount;

  if (!account) {
    return NextResponse.json({ notifications });
  }

  // ── Tier progress notifications ──────────────────────────
  const currentTier = account.lastTier as TierId;
  const count7d = account.lastCount7d;
  const windowDays = await loadTierWindowDays();
  const windowLabel = formatTierWindowLabel(windowDays);

  // Find the next tier
  const TIERS = await loadTiers();
  // For WELCOME tier, compute next tier based on earned tier from order count
  let tierIndex: number;
  if (currentTier === "WELCOME" || currentTier === "NONE") {
    // Find what tier they'd actually qualify for by order count
    const sorted = [...TIERS].sort((a, b) => b.minOrders - a.minOrders);
    const earned = sorted.find((t) => count7d >= t.minOrders);
    tierIndex = earned ? TIERS.findIndex((t) => t.id === earned.id) : -1;
  } else {
    tierIndex = TIERS.findIndex((t) => t.id === currentTier);
  }
  const nextTier = tierIndex < TIERS.length - 1
    ? TIERS[tierIndex + 1]
    : tierIndex === -1
      ? TIERS[0] // Currently NONE or below first tier, next is first tier
      : null;

  if (nextTier) {
    const ordersNeeded = nextTier.minOrders - count7d;
    if (ordersNeeded > 0) {
      if (ordersNeeded <= 5) {
        notifications.push({
          id: "tier-almost",
          type: "tier_progress",
          title: "Almost there!",
          message: `Just ${ordersNeeded} more order${ordersNeeded === 1 ? "" : "s"} in the next ${windowLabel} to unlock ${nextTier.discount}% off!`,
          variant: "warning",
        });
      } else if (ordersNeeded <= 15) {
        notifications.push({
          id: "tier-progress",
          type: "tier_progress",
          title: "Tier Progress",
          message: `${ordersNeeded} more orders needed for ${nextTier.discount}% off. You're ${Math.round(((nextTier.minOrders - ordersNeeded) / nextTier.minOrders) * 100)}% of the way there!`,
          variant: "info",
        });
      } else {
        notifications.push({
          id: "tier-goal",
          type: "tier_progress",
          title: "Next Tier Goal",
          message: `Reach ${nextTier.minOrders} orders in ${windowLabel} to unlock ${nextTier.discount}% off. You have ${count7d} so far.`,
          variant: "default",
        });
      }
    }
  }

  // Currently at max tier
  const maxTier = TIERS.length > 0 ? TIERS[TIERS.length - 1] : null;
  if (maxTier && currentTier === maxTier.id) {
    notifications.push({
      id: "tier-max",
      type: "tier_achieved",
      title: "Top Tier Achieved!",
      message: `You're at the highest discount tier — ${maxTier.discount}% off. Keep up the great work!`,
      variant: "success",
    });
  }

  // Encouragement if they have orders
  if (count7d > 0 && (!maxTier || currentTier !== maxTier.id)) {
    notifications.push({
      id: "encouragement",
      type: "encouragement",
      title: "Keep it up!",
      message: `You've placed ${count7d} qualifying order${count7d === 1 ? "" : "s"} in the current ${windowLabel} window. Every order counts toward your next tier!`,
      variant: "info",
    });
  }

  // ── Business info change notifications ─────────────────────
  const recentChanges = await db.businessInfoChange.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  for (const change of recentChanges) {
    if (change.status === "PENDING") {
      notifications.push({
        id: `info-change-pending-${change.id}`,
        type: "info_change_pending",
        title: "Change Under Review",
        message: "Your business information update is being reviewed by our team.",
        variant: "warning",
        timestamp: change.createdAt.toISOString(),
      });
    } else if (change.status === "APPROVED" && change.reviewedAt) {
      const daysSince = (Date.now() - change.reviewedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 7) {
        notifications.push({
          id: `info-change-approved-${change.id}`,
          type: "info_change_approved",
          title: "Changes Approved",
          message: `Your business information update was approved${change.reviewNote ? `: ${change.reviewNote}` : "."}`,
          variant: "success",
          timestamp: change.reviewedAt.toISOString(),
        });
      }
    } else if (change.status === "DENIED" && change.reviewedAt) {
      const daysSince = (Date.now() - change.reviewedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 14) {
        notifications.push({
          id: `info-change-denied-${change.id}`,
          type: "info_change_denied",
          title: "Changes Denied",
          message: `Your business information update was not approved${change.reviewNote ? `: ${change.reviewNote}` : ". Contact support for details."}`,
          variant: "warning",
          timestamp: change.reviewedAt.toISOString(),
        });
      }
    }
  }

  return NextResponse.json({ notifications });
}
