export type OrderDecision =
  | { action: "ignore" }
  | { action: "queue" }
  | {
      action: "hold";
      reason:
        | "incomplete_address"
        | "missing_phone"
        | "store_paused"
        | "needs_retest"
        | "out_of_stock"
        | "card_missing"
        | "card_declined";
    }
  | { action: "charge" };

export function decidePaidOrder(input: {
  financialStatus: string | null | undefined;
  channelEnabled: boolean;
  storePaused: boolean;
  addressTestPassed: boolean;
  street?: string | null;
  country?: string | null;
  phone?: string | null;
  stockOk: boolean;
  hasCard: boolean;
}): OrderDecision {
  const paid = (input.financialStatus || "").toLowerCase() === "paid";
  if (!paid) return { action: "ignore" };
  if (!input.channelEnabled) return { action: "queue" };
  if (input.storePaused) return { action: "hold", reason: "store_paused" };
  if (!input.street?.trim() || !input.country?.trim()) {
    return { action: "hold", reason: "incomplete_address" };
  }
  if (!input.addressTestPassed) return { action: "hold", reason: "needs_retest" };
  const country = input.country.trim().toLowerCase();
  const domestic =
    country === "us" ||
    country === "usa" ||
    country === "united states" ||
    country === "united states of america";
  if (!domestic && !input.phone?.trim()) {
    return { action: "hold", reason: "missing_phone" };
  }
  if (!input.stockOk) return { action: "hold", reason: "out_of_stock" };
  if (!input.hasCard) return { action: "hold", reason: "card_missing" };
  return { action: "charge" };
}
