export const DEFAULT_TIER_WINDOW_DAYS = 7;
export const MIN_TIER_WINDOW_DAYS = 1;
export const MAX_TIER_WINDOW_DAYS = 365;

export function normalizeTierWindowDays(
  value: unknown,
  fallback: number = DEFAULT_TIER_WINDOW_DAYS
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const whole = Math.floor(parsed);
  if (whole < MIN_TIER_WINDOW_DAYS || whole > MAX_TIER_WINDOW_DAYS) return fallback;
  return whole;
}

export function formatTierWindowLabel(days: number): string {
  const safeDays = normalizeTierWindowDays(days);
  return `${safeDays} day${safeDays === 1 ? "" : "s"}`;
}

export function getTierWindowStartDate(days: number, now: number = Date.now()): Date {
  const safeDays = normalizeTierWindowDays(days);
  return new Date(now - safeDays * 24 * 60 * 60 * 1000);
}
