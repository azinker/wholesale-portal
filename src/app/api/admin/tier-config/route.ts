import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import {
  loadTiers,
  saveTiers,
  loadWelcomeConfig,
  saveWelcomeConfig,
  recalcAllTiers,
  type TierDef,
  type WelcomeDiscountConfig,
} from "@/lib/tier-engine";
import { db } from "@/lib/db";

/**
 * GET /api/admin/tier-config
 * Returns the current tier configuration + welcome discount config.
 */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = await loadTiers();
  const welcome = await loadWelcomeConfig();
  return NextResponse.json({ tiers, welcome });
}

/**
 * PUT /api/admin/tier-config
 * Saves a new tier configuration and triggers a full recalculation.
 */
export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tiers, welcome } = body as {
      tiers: TierDef[];
      welcome?: WelcomeDiscountConfig;
    };

    // ── Validate ────────────────────────────────────────
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json(
        { error: "At least one tier is required." },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    const seenIds = new Set<string>();
    const seenDiscounts = new Set<number>();
    const seenOrders = new Set<number>();

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
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

    // Sort by minOrders ascending before saving
    const sorted = [...tiers].sort((a, b) => a.minOrders - b.minOrders);

    // ── Save ────────────────────────────────────────────
    await saveTiers(sorted);

    // Save welcome config if provided
    if (welcome) {
      await saveWelcomeConfig(welcome);
    }

    // ── Audit log ───────────────────────────────────────
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "tier_config_updated",
        details: JSON.parse(JSON.stringify({ tiers: sorted })),
      },
    });

    // ── Recalculate all tiers ───────────────────────────
    const recalcResult = await recalcAllTiers();

    return NextResponse.json({
      success: true,
      tiers: sorted,
      recalc: recalcResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
