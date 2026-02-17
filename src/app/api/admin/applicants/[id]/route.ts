import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";

/** GET /api/admin/applicants/[id] — get full applicant details */
export async function GET(
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
      include: {
        user: true,
        documents: {
          orderBy: { uploadedAt: "desc" },
          select: {
            id: true,
            filename: true,
            mime: true,
            size: true,
            scanStatus: true,
            docType: true,
            state: true,
            note: true,
            uploadedAt: true,
          },
        },
        riskFlags: {
          where: { status: "OPEN" },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Admin applicant detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch applicant" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/applicants/[id] — completely remove an applicant.
 * Disables any active BigCommerce promotions, then deletes the PortalUser
 * (which cascades to WholesaleAccount and all related records).
 * The person can re-apply or be re-added afterward.
 */
export async function DELETE(
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
      include: {
        promotions: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Step 1: Remove coupons in BigCommerce — delete each promotion (removes coupon code entirely)
    for (const promo of account.promotions) {
      if (promo.promoId) {
        try {
          await bc().updatePromotion(promo.promoId, { status: "DISABLED" });
        } catch {
          // Ignore disable errors (promo may already be gone)
        }
        try {
          await bc().deletePromotion(promo.promoId);
        } catch (err) {
          console.warn(`Failed to delete BC promo ${promo.promoId}:`, err);
          // Continue — we still remove the account and customer group
        }
      }
    }

    // Step 2: Remove the customer from the Wholesale group in BigCommerce (0 = default/retail)
    if (account.customerId) {
      try {
        await bc().updateCustomerGroup(account.customerId, 0);
      } catch (err) {
        console.warn("Failed to remove customer from BC group:", err);
      }
    }

    // Step 3: Audit log (before deletion so we still have the data)
    await db.auditLog.create({
      data: {
        actorEmail: user.email,
        action: "applicant_removed",
        targetCustomerId: account.customerId,
        targetAccountId: account.id,
        details: {
          companyName: account.companyName,
          email: account.email,
          status: account.status,
          lastTier: account.lastTier,
        },
      },
    });

    // Step 4: Delete the PortalUser — cascades to WholesaleAccount
    // and all related records (documents, promotions, snapshots, etc.)
    await db.portalUser.delete({
      where: { id: account.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove applicant error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove applicant" },
      { status: 500 }
    );
  }
}
