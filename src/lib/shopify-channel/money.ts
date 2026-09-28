import { INTERNATIONAL_SHIPPING_USD } from "./constants";

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function isUnitedStates(country: string | null | undefined): boolean {
  const value = (country || "").trim().toLowerCase();
  return (
    value === "us" ||
    value === "usa" ||
    value === "united states" ||
    value === "united states of america"
  );
}

/** US, including PO Boxes, Alaska, and Hawaii, is $0. Every other country is $18.99 once. */
export function shippingForCountry(country: string | null | undefined): number {
  if (!country || !country.trim()) return 0;
  return isUnitedStates(country) ? 0 : INTERNATIONAL_SHIPPING_USD;
}

export function wholesaleUnitCost(retail: number, discountPercent: number): number {
  const pct = Math.min(100, Math.max(0, discountPercent));
  return roundMoney(retail * (1 - pct / 100));
}

export interface ChargeLineInput {
  retail: number;
  quantity: number;
  discountPercent: number;
  salePrice: number;
}

export interface ChargeQuote {
  lines: Array<{ unitCost: number; lineCost: number; saleTotal: number }>;
  goods: number;
  shipping: number;
  total: number;
  soldFor: number;
}

/** Charge is today's tier cost, not the Shopify sale price. Shipping is once per order. */
export function quoteChannelCharge(
  lines: ChargeLineInput[],
  country: string | null | undefined
): ChargeQuote {
  const priced = lines.map((line) => {
    const unitCost = wholesaleUnitCost(line.retail, line.discountPercent);
    const qty = Math.max(0, line.quantity);
    return {
      unitCost,
      lineCost: roundMoney(unitCost * qty),
      saleTotal: roundMoney(line.salePrice * qty),
    };
  });
  const goods = roundMoney(priced.reduce((sum, line) => sum + line.lineCost, 0));
  const shipping = shippingForCountry(country);
  const soldFor = roundMoney(priced.reduce((sum, line) => sum + line.saleTotal, 0));
  return {
    lines: priced,
    goods,
    shipping,
    total: roundMoney(goods + shipping),
    soldFor,
  };
}

export function addressIsComplete(input: {
  street?: string | null;
  country?: string | null;
}): boolean {
  return Boolean(input.street?.trim() && input.country?.trim());
}

export function phoneRequiredAndMissing(input: {
  country?: string | null;
  phone?: string | null;
}): boolean {
  if (!input.country?.trim() || isUnitedStates(input.country)) return false;
  return !input.phone?.trim();
}
