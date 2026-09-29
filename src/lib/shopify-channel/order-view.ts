export type OrderLine = {
  title?: string;
  quantity?: number;
  salePrice?: number;
  unitCost?: number;
  lineCost?: number;
  bcProductId?: number;
};

const AWAITING = new Set(["QUEUED", "HELD", "CHARGED", "SUBMITTED", "PICKING"]);

export function affiliatedLines(lines: unknown): OrderLine[] {
  if (!Array.isArray(lines)) return [];
  return lines.filter((line) => line && typeof line === "object") as OrderLine[];
}

export function isAffiliatedOrder(order: {
  shopifyOrderId: string;
  shopifyOrderName?: string | null;
  lines: unknown;
}): boolean {
  if (order.shopifyOrderId === "preview" || order.shopifyOrderName === "#PREVIEW") return false;
  return affiliatedLines(order.lines).length > 0;
}

export function orderView(status: string): "awaiting" | "shipped" | "attention" | "closed" {
  if (status === "SHIPPED") return "shipped";
  if (status === "NEEDS_ATTENTION" || status === "FAILED") return "attention";
  if (status === "REFUNDED") return "closed";
  if (AWAITING.has(status)) return "awaiting";
  return "closed";
}

export function wasCharged(order: { amountCharged: unknown }): boolean {
  return Number(order.amountCharged) > 0;
}

export function netCharged(order: { amountCharged: unknown; amountRefunded: unknown }): number {
  return Number(order.amountCharged) - Number(order.amountRefunded);
}

export function whenEastern(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
