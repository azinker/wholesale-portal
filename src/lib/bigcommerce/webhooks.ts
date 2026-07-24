import { db } from "@/lib/db";
import { sendNewApplicantNotification } from "@/lib/email";
import { bc } from "./client";

/** BC form fields may return strings, numbers, or booleans. */
export function isWholesaleFormValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "yes" || normalized === "true";
}

/**
 * Process a webhook event asynchronously.
 * Called after the event is stored in the database.
 */
export async function processWebhookEvent(
  eventId: string,
  scope: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await db.webhookEvent.update({
      where: { id: eventId },
      data: { status: "PROCESSING" },
    });

    switch (scope) {
      case "store/customer/created":
      case "store/customer/updated":
        await handleCustomerEvent(data);
        break;

      case "store/order/created":
      case "store/order/statusUpdated":
      case "store/order/updated":
        await handleOrderEvent(data);
        break;

      default:
        console.log(`Unhandled webhook scope: ${scope}`);
    }

    await db.webhookEvent.update({
      where: { id: eventId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.webhookEvent.update({
      where: { id: eventId },
      data: { status: "FAILED", error: message },
    });
    throw error;
  }
}

/**
 * Handle customer created/updated webhook.
 * Check if the customer has the "wholesale account" form field checked.
 * If so, create or update a WholesaleAccount record.
 */
async function handleCustomerEvent(data: Record<string, unknown>): Promise<void> {
  const customerId = (data as { id?: number }).id;
  if (!customerId) return;

  // Fetch customer details from BigCommerce
  const customer = await bc().getCustomerById(customerId);
  if (!customer) return;

  // Check for wholesale form field (customize field name as needed)
  const wholesaleField = customer.form_fields?.find(
    (f) =>
      f.name.toLowerCase().includes("wholesale") ||
      f.name.toLowerCase().includes("wholesale account")
  );

  const wantsWholesale = wholesaleField && isWholesaleFormValue(wholesaleField.value);

  if (!wantsWholesale) return;

  // Find or create PortalUser
  let portalUser = await db.portalUser.findUnique({
    where: { email: customer.email },
  });

  if (!portalUser) {
    portalUser = await db.portalUser.create({
      data: {
        email: customer.email,
        linkedCustomerId: customer.id,
      },
    });
  } else if (!portalUser.linkedCustomerId) {
    await db.portalUser.update({
      where: { id: portalUser.id },
      data: { linkedCustomerId: customer.id },
    });
  }

  // Find or create WholesaleAccount (don't overwrite if already APPROVED)
  const existing = await db.wholesaleAccount.findUnique({
    where: { userId: portalUser.id },
  });

  if (!existing) {
    const alias = (customer.company || customer.last_name || "COMPANY")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20);

    await db.wholesaleAccount.create({
      data: {
        userId: portalUser.id,
        customerId: customer.id,
        email: customer.email,
        companyName: customer.company || `${customer.first_name} ${customer.last_name}`,
        alias,
        status: "PENDING",
      },
    });

    await db.auditLog.create({
      data: {
        actorEmail: "system",
        action: "applicant_created_from_webhook",
        targetCustomerId: customer.id,
        details: {
          email: customer.email,
          company: customer.company,
          source: "bigcommerce_webhook",
        },
      },
    });

    await sendNewApplicantNotification({
      email: customer.email,
      companyName: customer.company || `${customer.first_name} ${customer.last_name}`,
      alias,
      source: "webhook",
      firstName: customer.first_name,
      lastName: customer.last_name,
      customerId: customer.id,
    });
  } else if (!existing.customerId) {
    // Link customer ID if missing
    await db.wholesaleAccount.update({
      where: { id: existing.id },
      data: { customerId: customer.id },
    });
  }
}

/**
 * Handle order created/updated webhook.
 * Triggers a tier recalculation for the customer if they're an approved wholesale customer.
 */
export async function handleOrderEvent(data: Record<string, unknown>): Promise<void> {
  const orderId = (data as { id?: number }).id;
  if (!orderId) return;

  // Look up the order to get the customer_id
  try {
    const order = await fetchOrderById(orderId);
    if (!order) return;

    if (order.customer_id) {
      // Existing reseller path remains customer-ID based and Wholesale-only.
      const account = await db.wholesaleAccount.findFirst({
        where: {
          customerId: order.customer_id,
          status: "APPROVED",
          partnerType: "DROPSHIPPER",
        },
      });

      if (account) {
        const { recalcTier } = await import("@/lib/tier-engine");
        const result = await recalcTier(account.id);

        console.log(
          `Order ${orderId} webhook → tier recalc for ${account.companyName}: ` +
            `${result.previousTier} → ${result.newTier} (${result.count7d} orders)`
        );

        const { runRiskChecks } = await import("@/lib/risk-detection");
        runRiskChecks(account.id).catch((err) => {
          console.error(`Risk checks failed for account ${account.id}:`, err);
        });
      }
    }

    // Publisher attribution is coupon-based and intentionally supports guest checkout.
    const { attributePublisherOrder, recalcPublisherTier } = await import(
      "@/lib/publisher-tier-engine"
    );
    const attribution = await attributePublisherOrder(order);
    if (attribution.accountId) {
      await recalcPublisherTier(attribution.accountId);
      const { runPublisherBurstRiskCheck } = await import("@/lib/risk-detection");
      runPublisherBurstRiskCheck(attribution.accountId).catch((err) => {
        console.error(`Publisher burst check failed for ${attribution.accountId}:`, err);
      });
    }
  } catch (err) {
    console.error(`Order webhook processing failed for order ${orderId}:`, err);
    throw err;
  }
}

/** Fetch a single order by ID from BC V2 */
async function fetchOrderById(orderId: number) {
  return bc().getOrderByIdStrict(orderId);
}
