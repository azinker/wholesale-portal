import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import {
  loadTiers,
  saveTiers,
  loadTierWindowDays,
  saveTierWindowDays,
  loadWelcomeConfig,
  saveWelcomeConfig,
  recalcAllTiers,
  type TierDef,
  type WelcomeDiscountConfig,
} from "@/lib/tier-engine";
import { db } from "@/lib/db";
import {
  MAX_TIER_WINDOW_DAYS,
  MIN_TIER_WINDOW_DAYS,
} from "@/lib/tier-window";
import {
  loadPublisherTierConfig,
  recalcAllPublisherTiers,
  savePublisherTierConfig,
} from "@/lib/publisher-tier-engine";

/**
 * GET /api/admin/tier-config
 * Returns the current tier configuration + rolling window + welcome discount config.
 */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = await loadTiers();
  const windowDays = await loadTierWindowDays();
  const welcome = await loadWelcomeConfig();
  const publisher = await loadPublisherTierConfig();
  return NextResponse.json({
    tiers,
    windowDays,
    welcome,
    publisherTiers: publisher.tiers,
    publisherTierWindowDays: publisher.windowDays,
  });
}

/**
 * PUT /api/admin/tier-config
 * Saves a new tier configuration and/or rolling window and triggers a full recalculation.
 */
export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tiers, welcome, windowDays, publisherTiers, publisherTierWindowDays } = body as {
      tiers?: TierDef[];
      welcome?: WelcomeDiscountConfig;
      windowDays?: number;
      publisherTiers?: TierDef[];
      publisherTierWindowDays?: number;
    };

    // ── Validate ────────────────────────────────────────
    if (tiers !== undefined && (!Array.isArray(tiers) || tiers.length === 0)) {
      return NextResponse.json(
        { error: "At least one tier is required." },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    const seenIds = new Set<string>();
    const seenDiscounts = new Set<number>();
    const seenOrders = new Set<number>();

    const effectiveTiers = tiers ?? await loadTiers();
    for (let i = 0; i < effectiveTiers.length; i++) {
      const t = effectiveTiers[i];
      if (!t.id || !t.label || t.minOrders == null || t.discount == null) {
        errors.push(`Tier ${i + 1}: All fields (id, label, minOrders, discount) are required.`);
        continue;
      }
      if (t.discount <= 0 || t.discount > 100) {
        errors.push(`Tier "${t.id}": Discount must be between 1 and 100.`);
      }
      if (t.minOrders < 1) {
        errors.push(`Tier "${t.id}": Minimum orders must be at least 1.`);
      }
      if (seenIds.has(t.id)) {
        errors.push(`Duplicate tier ID: "${t.id}".`);
      }
      if (seenDiscounts.has(t.discount)) {
        errors.push(`Duplicate discount percentage: ${t.discount}%.`);
      }
      if (seenOrders.has(t.minOrders)) {
        errors.push(`Duplicate order threshold: ${t.minOrders}.`);
      }
      seenIds.add(t.id);
      seenDiscounts.add(t.discount);
      seenOrders.add(t.minOrders);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    if (publisherTiers) {
      const required = new Map(publisherTiers.map((tier) => [tier.id, tier]));
      const floor = required.get("P15");
      const p20 = required.get("P20");
      const p25 = required.get("P25");
      if (
        publisherTiers.length !== 3 ||
        required.size !== 3 ||
        !floor ||
        floor.minOrders !== 0 ||
        floor.discount !== 15 ||
        !p20 ||
        !p25
      ) {
        return NextResponse.json(
          { error: "Publisher tiers must contain P15 (15% at 0 orders), P20, and P25." },
          { status: 400 }
        );
      }
      const publisherValuesValid = publisherTiers.every(
        (tier) =>
          Number.isInteger(tier.minOrders) &&
          tier.minOrders >= 0 &&
          Number.isFinite(tier.discount) &&
          tier.discount > 0 &&
          tier.discount <= 100
      );
      if (
        !publisherValuesValid ||
        p20.minOrders <= floor.minOrders ||
        p25.minOrders <= p20.minOrders ||
        p20.discount <= floor.discount ||
        p25.discount <= p20.discount
      ) {
        return NextResponse.json(
          {
            error:
              "Publisher thresholds and discounts must be valid and increase from P15 to P20 to P25.",
          },
          { status: 400 }
        );
      }
    }
    if (
      publisherTierWindowDays !== undefined &&
      (!Number.isInteger(publisherTierWindowDays) ||
        publisherTierWindowDays < 1 ||
        publisherTierWindowDays > 90)
    ) {
      return NextResponse.json(
        { error: "Publisher rolling window must be an integer between 1 and 90 days." },
        { status: 400 }
      );
    }

    const currentWindowDays = await loadTierWindowDays();
    let normalizedWindowDays = currentWindowDays;
    if (windowDays !== undefined) {
      const parsedWindowDays = Number(windowDays);
      if (
        !Number.isInteger(parsedWindowDays) ||
        parsedWindowDays < MIN_TIER_WINDOW_DAYS ||
        parsedWindowDays > MAX_TIER_WINDOW_DAYS
      ) {
        return NextResponse.json(
          {
            error: `Rolling window must be an integer between ${MIN_TIER_WINDOW_DAYS} and ${MAX_TIER_WINDOW_DAYS} days.`,
          },
          { status: 400 }
        );
      }
      normalizedWindowDays = parsedWindowDays;
    }

    // Sort by minOrders ascending before saving
    const sorted = [...effectiveTiers].sort((a, b) => a.minOrders - b.minOrders);

    // ── Save ────────────────────────────────────────────
    if (tiers) {
      await saveTiers(sorted);
    }
    if (windowDays !== undefined) {
      await saveTierWindowDays(normalizedWindowDays);
    }

    // Save welcome config if provided
    if (welcome) {
      await saveWelcomeConfig(welcome);
    }
    const currentPublisher = await loadPublisherTierConfig();
    if (publisherTiers || publisherTierWindowDays !== undefined) {
      await savePublisherTierConfig(
        [...(publisherTiers ?? currentPublisher.tiers)].sort(
          (a, b) => a.minOrders - b.minOrders
        ),
        publisherTierWindowDays ?? currentPublisher.windowDays
      );
    }

    // ── Audit log ───────────────────────────────────────
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "tier_config_updated",
        details: JSON.parse(
          JSON.stringify({
            tiers: sorted,
            windowDays: normalizedWindowDays,
            publisherTiers,
            publisherTierWindowDays,
          })
        ),
      },
    });

    // ── Recalculate all tiers ───────────────────────────
    const recalcResult =
      tiers || windowDays !== undefined || welcome
        ? await recalcAllTiers()
        : undefined;
    const publisherRecalc =
      publisherTiers || publisherTierWindowDays !== undefined
        ? await recalcAllPublisherTiers()
        : undefined;

    return NextResponse.json({
      success: true,
      tiers: sorted,
      windowDays: normalizedWindowDays,
      recalc: recalcResult,
      publisherRecalc,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
