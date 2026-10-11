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
  if (status === "SHIPPED" || status === "DELIVERED") return "shipped";
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

export function fullyRefunded(order: { amountCharged: unknown; amountRefunded: unknown }): boolean {
  const charged = Number(order.amountCharged);
  const refunded = Number(order.amountRefunded);
  return charged > 0 && refunded + 0.001 >= charged;
}

export function whenEastern(date: Date): string {
  const formatted = date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatted} ET`;
}

export function periodChange(current: number, previous: number): { direction: "up" | "down" | "flat"; percent: number | null } {
  const now = Math.round(current * 100) / 100;
  const then = Math.round(previous * 100) / 100;
  if (now === then) return { direction: "flat", percent: then === 0 ? null : 0 };
  if (then === 0) return { direction: now > 0 ? "up" : "down", percent: null };
  return {
    direction: now > then ? "up" : "down",
    percent: ((now - then) / Math.abs(then)) * 100,
  };
}
