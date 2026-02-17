import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sanitize company name into a stable alias (uppercase, alphanumeric + hyphens) */
export function toAlias(companyName: string): string {
  return companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

/** Generate a random 6-character alphanumeric string */
export function randomCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Format a coupon code: WS-<ALIAS>-T<tier>-<RANDOM6> */
export function formatCouponCode(alias: string, tier: number): string {
  return `WS-${alias}-T${tier}-${randomCode()}`;
}
