import { env } from "@/lib/env";
import { STATEMENT_DESCRIPTOR } from "./constants";

function secret(): string {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  return key;
}

async function stripeRequest(path: string, body?: URLSearchParams, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret()}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const json = (await res.json()) as {
    error?: { message?: string };
    [key: string]: unknown;
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe ${path} failed`);
  }
  return json;
}

export function stripeConfigured(): boolean {
  return Boolean(env().STRIPE_SECRET_KEY);
}

export async function createStripeCustomer(email: string, name: string): Promise<string> {
  const body = new URLSearchParams({ email, name });
  const json = await stripeRequest("customers", body);
  return String(json.id);
}

export async function createSetupIntent(customerId: string): Promise<string> {
  const body = new URLSearchParams({
    customer: customerId,
    usage: "off_session",
    "automatic_payment_methods[enabled]": "true",
  });
  const json = await stripeRequest("setup_intents", body);
  return String(json.client_secret);
}

export async function readSetupIntent(setupIntentId: string): Promise<{
  status: string;
  paymentMethodId: string | null;
  customerId: string | null;
}> {
  const json = await stripeRequest(`setup_intents/${setupIntentId}`, undefined, "GET");
  return {
    status: String(json.status || ""),
    paymentMethodId: json.payment_method ? String(json.payment_method) : null,
    customerId: json.customer ? String(json.customer) : null,
  };
}

export async function readCard(paymentMethodId: string): Promise<{ brand: string; last4: string }> {
  const json = await stripeRequest(`payment_methods/${paymentMethodId}`, undefined, "GET");
  const card = (json.card || {}) as { brand?: string; last4?: string };
  return { brand: card.brand || "card", last4: card.last4 || "" };
}

export async function chargeCard(input: {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  idempotencyKey: string;
  description: string;
}): Promise<{ paymentIntentId: string; chargeId: string | null }> {
  const body = new URLSearchParams({
    amount: String(input.amountCents),
    currency: "usd",
    customer: input.customerId,
    payment_method: input.paymentMethodId,
    off_session: "true",
    confirm: "true",
    description: input.description,
    statement_descriptor: STATEMENT_DESCRIPTOR,
  });
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body,
  });
  const json = (await res.json()) as {
    id?: string;
    status?: string;
    latest_charge?: string;
    error?: { message?: string };
  };
  if (!res.ok || json.status !== "succeeded") {
    throw new Error(json.error?.message || `Card charge did not succeed (${json.status || res.status})`);
  }
  return {
    paymentIntentId: String(json.id),
    chargeId: json.latest_charge ? String(json.latest_charge) : null,
  };
}

export async function createCardSetupCheckout(
  customerId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const body = new URLSearchParams({
    mode: "setup",
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    "payment_method_types[0]": "card",
  });
  const json = await stripeRequest("checkout/sessions", body);
  return String(json.url);
}

export async function readCheckoutSession(sessionId: string): Promise<{
  setupIntentId: string | null;
  customerId: string | null;
}> {
  const json = await stripeRequest(`checkout/sessions/${sessionId}`, undefined, "GET");
  return {
    setupIntentId: json.setup_intent ? String(json.setup_intent) : null,
    customerId: json.customer ? String(json.customer) : null,
  };
}

export async function refundCharge(chargeId: string, amountCents?: number): Promise<void> {
  const body = new URLSearchParams({ charge: chargeId });
  if (amountCents != null) body.set("amount", String(amountCents));
  await stripeRequest("refunds", body);
}
