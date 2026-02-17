import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";
import { bc } from "@/lib/bigcommerce/client";

/**
 * POST /api/admin/verify-customer-group
 *
 * Verifies a customer's group assignment in BigCommerce.
 * Returns customer details including group IDs and names.
 *
 * Body: { accountId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const accountId = body.accountId as string;

    if (!accountId) {
      return NextResponse.json({ error: "accountId required" }, { status: 400 });
    }

    const account = await db.wholesaleAccount.findUnique({
      where: { id: accountId },
      select: { customerId: true, companyName: true, email: true },
    });

    if (!account || !account.customerId) {
      return NextResponse.json(
        { error: "Account not found or no BC customer ID" },
        { status: 404 }
      );
    }

    // Fetch customer from BigCommerce
    const customer = await bc().getCustomerById(account.customerId);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found in BigCommerce" },
        { status: 404 }
      );
    }

    // Fetch all customer groups to map IDs to names
    const groups = await bc().getCustomerGroups();
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));

    // Get customer's group (BigCommerce V2 API: single group per customer)
    const customerGroupId = customer.customer_group_id;
    const customerGroups = customerGroupId
      ? [{ id: customerGroupId, name: groupMap.get(customerGroupId) || "Unknown" }]
      : [];

    return NextResponse.json({
      customerId: customer.id,
      email: customer.email,
      companyName: customer.company,
      firstName: customer.first_name,
      lastName: customer.last_name,
      groups: customerGroups,
      taxExemptCategory: (customer as { tax_exempt_category?: string }).tax_exempt_category || null,
      allAvailableGroups: groups.map((g) => ({ id: g.id, name: g.name })),
    });
  } catch (error) {
    console.error("Customer group verification error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify customer group",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
