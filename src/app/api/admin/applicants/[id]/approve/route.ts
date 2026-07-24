import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import {
  loadWelcomeConfig,
  loadTierWindowDays,
  QUALIFYING_TIER_STATUS_IDS,
  ensurePromoForTier,
  tierFromCount,
  getTierConfig,
} from "@/lib/tier-engine";
import { getTierWindowStartDate } from "@/lib/tier-window";
import { sendApplicantApprovalEmail } from "@/lib/email";
import { sendPublisherApprovalEmail } from "@/lib/email";
import {
  ensurePublisherPromoForTier,
  withPublisherTierLock,
} from "@/lib/publisher-tier-engine";

const WHOLESALE_GROUP_NAME = "Wholesale";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const account = await db.wholesaleAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (account.status === "APPROVED") {
      return NextResponse.json({ error: "Already approved" }, { status: 400 });
    }

    if (account.status !== "PENDING" && account.status !== "RETAIL") {
      return NextResponse.json(
        { error: "Only pending applications can be approved" },
        { status: 400 }
      );
    }

    if (account.partnerType === "AFFILIATE_PUBLISHER") {
      const promotion = await withPublisherTierLock(account.id, async () => {
        // Create the guest-eligible audience promotion before changing status so
        // an external BC failure cannot leave an approved publisher with a dead code.
        const created = await ensurePublisherPromoForTier(
          account.id,
          account.alias,
          "P15"
        );
        await db.wholesaleAccount.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            lastTier: "P15",
            lastCount14d: 0,
            welcomeExpiresAt: null,
          },
        });
        await db.auditLog.create({
          data: {
            actorEmail: user.email,
            action: "publisher_applicant_approved",
            targetAccountId: account.id,
            details: {
              companyName: account.companyName,
              initialTier: "P15",
              code: created.code,
              wholesaleGroupAssigned: false,
            },
          },
        });
        return created;
      });
      sendPublisherApprovalEmail(
        account.email,
        account.companyName,
        promotion.code
      ).catch((err) => console.warn("Publisher approval email send failed:", err));
      return NextResponse.json({ success: true, tier: "P15", code: promotion.code });
    }

    // Find or create the Wholesale customer group in BigCommerce
    let groupId: number | null = null;
    try {
      let group = await bc().getCustomerGroupByName(WHOLESALE_GROUP_NAME);
      if (!group) {
        // Auto-create the Wholesale group if it doesn't exist
        console.log(`Creating "${WHOLESALE_GROUP_NAME}" customer group in BigCommerce...`);
        group = await bc().createCustomerGroup(WHOLESALE_GROUP_NAME);
      }
      if (group) {
        groupId = group.id;
      }
    } catch (err) {
      console.warn("Could not manage customer groups:", err);
    }

    // Assign customer to the wholesale group in BigCommerce
    if (groupId && account.customerId) {
      try {
        await bc().updateCustomerGroup(account.customerId, groupId);
      } catch (err) {
        console.warn("Could not assign customer group:", err);
        // Don't fail the approval — group can be assigned manually
      }
    }

    // ── Check existing order history to decide welcome vs earned tier ──
    const welcomeCfg = await loadWelcomeConfig();
    const windowDays = await loadTierWindowDays();
    let initialTier = "NONE";
    let welcomeExpiresAt: Date | null = null;
    let qualifyingCount = 0;

    if (account.customerId) {
      // Fetch orders for this customer in the configured rolling window
      try {
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
        qualifyingCount = allOrders.filter((o) =>
          QUALIFYING_TIER_STATUS_IDS.includes(o.status_id)
        ).length;
      } catch (err) {
        console.warn("Could not fetch order history on approval:", err);
      }
    }

    // Determine earned tier from existing orders
    const earnedTierId = await tierFromCount(qualifyingCount);
    const earnedTierConfig = earnedTierId !== "NONE" ? await getTierConfig(earnedTierId) : null;
    const earnedDiscount = earnedTierConfig?.discount ?? 0;

    if (welcomeCfg.enabled && earnedDiscount < welcomeCfg.discount) {
      // Earned tier is lower than welcome discount → use welcome
      initialTier = "WELCOME";
      welcomeExpiresAt = new Date(Date.now() + welcomeCfg.hours * 60 * 60 * 1000);
    } else if (earnedTierId !== "NONE") {
      // Earned tier is >= welcome discount → skip welcome, go straight to earned tier
      initialTier = earnedTierId;
    }

    // Update the account status
    const updatedAccount = await db.wholesaleAccount.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        lastTier: initialTier,
        lastCount7d: qualifyingCount,
        welcomeExpiresAt,
      },
    });

    // Create the appropriate promotion in BigCommerce
    if (initialTier !== "NONE") {
      try {
        await ensurePromoForTier(updatedAccount.id, updatedAccount.alias, initialTier);
      } catch (err) {
        console.warn("Failed to create promo on approval:", err);
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "applicant_approved",
        targetCustomerId: account.customerId,
        targetAccountId: account.id,
        details: {
          companyName: account.companyName,
          bcGroupId: groupId,
          bcGroupName: WHOLESALE_GROUP_NAME,
        },
      },
    });

    // Notify applicant by email (do not fail approval if email fails)
    sendApplicantApprovalEmail(account.email, account.companyName).catch((err) => {
      console.warn("Approval email send failed:", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json(
      { error: "Failed to approve applicant" },
      { status: 500 }
    );
  }
}
