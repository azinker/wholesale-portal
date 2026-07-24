import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import {
  sendNewApplicantNotification,
  sendPublisherApprovalEmail,
} from "@/lib/email";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import { Prisma } from "@prisma/client";
import {
  loadWelcomeConfig,
  loadTierWindowDays,
  QUALIFYING_TIER_STATUS_IDS,
  ensurePromoForTier,
  tierFromCount,
  getTierConfig,
} from "@/lib/tier-engine";
import { getTierWindowStartDate } from "@/lib/tier-window";
import { ensurePublisherPromoForTier } from "@/lib/publisher-tier-engine";
import { toAlias } from "@/lib/utils";

const WHOLESALE_GROUP_NAME = "Wholesale";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      email,
      companyName,
      partnerType = "DROPSHIPPER",
      promoWebsite,
      awinPublisherId,
    } = body;

    if (!email || !companyName) {
      return NextResponse.json(
        { error: "Email and company name are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already enrolled
    const existingAccount = await db.wholesaleAccount.findFirst({
      where: { email: normalizedEmail },
    });
    if (existingAccount) {
      return NextResponse.json(
        { error: "This email already has a wholesale account" },
        { status: 409 }
      );
    }

    if (partnerType === "AFFILIATE_PUBLISHER") {
      let portalUser = await db.portalUser.findUnique({
        where: { email: normalizedEmail },
      });
      if (!portalUser) {
        portalUser = await db.portalUser.create({ data: { email: normalizedEmail } });
      }
      const account = await db.wholesaleAccount.create({
        data: {
          userId: portalUser.id,
          customerId: null,
          email: normalizedEmail,
          companyName: companyName.trim(),
          alias: toAlias(companyName),
          partnerType: "AFFILIATE_PUBLISHER",
          promoWebsite: promoWebsite || null,
          awinPublisherId: awinPublisherId || null,
          status: "PENDING",
          lastTier: "P15",
          lastCount14d: 0,
          welcomeExpiresAt: null,
        },
      });
      const promotion = await ensurePublisherPromoForTier(
        account.id,
        account.alias,
        "P15"
      );
      await db.wholesaleAccount.update({
        where: { id: account.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
      await sendNewApplicantNotification({
        email: normalizedEmail,
        companyName: account.companyName,
        alias: account.alias,
        source: "admin",
        partnerType: "AFFILIATE_PUBLISHER",
        promoWebsite,
        awinPublisherId,
      });
      await sendPublisherApprovalEmail(
        normalizedEmail,
        account.companyName,
        promotion.code
      );
      return NextResponse.json({
        success: true,
        account: {
          id: account.id,
          email: normalizedEmail,
          companyName: account.companyName,
          partnerType: "AFFILIATE_PUBLISHER",
          initialTier: "P15",
          code: promotion.code,
          groupAssigned: false,
        },
      });
    }

    // Step 1: Check if customer exists in BigCommerce
    let bcCustomer = await bc().getCustomerByEmail(normalizedEmail);
    let wasCreated = false;

    if (!bcCustomer) {
      // Split company name into first/last for BigCommerce (requires non-empty last_name)
      const nameParts = companyName.trim().split(/\s+/);
      const firstName = nameParts[0] || companyName.trim();
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Wholesale";

      bcCustomer = await bc().createCustomer({
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName,
        company: companyName.trim(),
      });
      wasCreated = true;
    }

    // Step 2: Find or create the Wholesale customer group and assign
    let groupId: number | null = null;
    try {
      let group = await bc().getCustomerGroupByName(WHOLESALE_GROUP_NAME);
      if (!group) {
        // Create the Wholesale group if it doesn't exist
        const created = await bc().createCustomerGroup(WHOLESALE_GROUP_NAME);
        group = created;
      }
      if (group) {
        groupId = group.id;
        await bc().updateCustomerGroup(bcCustomer.id, groupId);
      }
    } catch (err) {
      console.warn("Could not manage customer group:", err);
    }

    // Step 3: Create PortalUser if not exists
    let portalUser = await db.portalUser.findUnique({
      where: { email: normalizedEmail },
    });
    if (!portalUser) {
      portalUser = await db.portalUser.create({
        data: {
          email: normalizedEmail,
          linkedCustomerId: bcCustomer.id,
        },
      });
    } else if (!portalUser.linkedCustomerId) {
      // Link the BC customer ID if missing
      await db.portalUser.update({
        where: { id: portalUser.id },
        data: { linkedCustomerId: bcCustomer.id },
      });
    }

    // Step 4: Check existing order history to decide welcome vs earned tier
    const welcomeCfg = await loadWelcomeConfig();
    const windowDays = await loadTierWindowDays();
    let initialTier = "NONE";
    let welcomeExpiresAt: Date | null = null;
    let qualifyingCount = 0;

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
          customer_id: bcCustomer.id,
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
      console.warn("Could not fetch order history on enrollment:", err);
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

    // Step 5: Create WholesaleAccount as APPROVED
    const alias = companyName
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 30)
      .toUpperCase();

    const account = await db.wholesaleAccount.create({
      data: {
        userId: portalUser.id,
        customerId: bcCustomer.id,
        email: normalizedEmail,
        companyName: companyName.trim(),
        alias,
        status: "APPROVED",
        approvedAt: new Date(),
        lastTier: initialTier,
        lastCount7d: qualifyingCount,
        welcomeExpiresAt,
      },
    });

    // Step 6: Create the appropriate promotion in BigCommerce
    if (initialTier !== "NONE") {
      try {
        await ensurePromoForTier(account.id, account.alias, initialTier);
      } catch (err) {
        console.warn("Failed to create promo on enrollment:", err);
      }
    }

    // Step 7: Audit log
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "admin_enroll_customer",
        targetCustomerId: bcCustomer.id,
        targetAccountId: account.id,
        details: {
          companyName: companyName.trim(),
          bcCustomerId: bcCustomer.id,
          wasNewBcCustomer: wasCreated,
          bcGroupId: groupId,
          initialTier,
          qualifyingCount,
          welcomeExpiresAt: welcomeExpiresAt?.toISOString() ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    // Notify wholesale@ (enrolled by admin)
    await sendNewApplicantNotification({
      email: normalizedEmail,
      companyName: account.companyName,
      alias: account.alias,
      source: "admin",
      customerId: bcCustomer.id,
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        email: normalizedEmail,
        companyName: account.companyName,
        bcCustomerId: bcCustomer.id,
        wasNewBcCustomer: wasCreated,
        groupAssigned: !!groupId,
        initialTier,
        qualifyingCount,
        welcomeActive: !!welcomeExpiresAt,
      },
    });
  } catch (error) {
    console.error("Enroll customer error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to enroll customer" },
      { status: 500 }
    );
  }
}
