import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { sendNewApplicantNotification } from "@/lib/email";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import { Prisma } from "@prisma/client";
import {
  recalcTier,
  loadWelcomeConfig,
  ensurePromoForTier,
  tierFromCount,
  getTierConfig,
} from "@/lib/tier-engine";

const WHOLESALE_GROUP_NAME = "Wholesale";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, companyName } = body;

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
    let initialTier = "NONE";
    let welcomeExpiresAt: Date | null = null;
    let qualifyingCount = 0;

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const minDate = sevenDaysAgo.toISOString().replace("T", " ").replace("Z", "");
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
      const qualifyingStatusIds = [2, 3, 10, 14];
      qualifyingCount = allOrders.filter((o) =>
        qualifyingStatusIds.includes(o.status_id)
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
