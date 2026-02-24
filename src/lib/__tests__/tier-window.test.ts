import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIER_WINDOW_DAYS,
  MAX_TIER_WINDOW_DAYS,
  MIN_TIER_WINDOW_DAYS,
  formatTierWindowLabel,
  getTierWindowStartDate,
  normalizeTierWindowDays,
} from "../tier-window";

describe("normalizeTierWindowDays", () => {
  it("returns the parsed integer for valid values", () => {
    expect(normalizeTierWindowDays(14)).toBe(14);
    expect(normalizeTierWindowDays("30")).toBe(30);
  });

  it("floors decimals", () => {
    expect(normalizeTierWindowDays(14.9)).toBe(14);
  });

  it("falls back for out-of-range values", () => {
    expect(normalizeTierWindowDays(0)).toBe(DEFAULT_TIER_WINDOW_DAYS);
    expect(normalizeTierWindowDays(MAX_TIER_WINDOW_DAYS + 1)).toBe(DEFAULT_TIER_WINDOW_DAYS);
  });

  it("falls back for invalid input", () => {
    expect(normalizeTierWindowDays("abc")).toBe(DEFAULT_TIER_WINDOW_DAYS);
    expect(normalizeTierWindowDays(null)).toBe(DEFAULT_TIER_WINDOW_DAYS);
  });

  it("supports custom fallback", () => {
    expect(normalizeTierWindowDays(-1, MIN_TIER_WINDOW_DAYS)).toBe(MIN_TIER_WINDOW_DAYS);
  });
});

describe("formatTierWindowLabel", () => {
  it("formats singular and plural labels", () => {
    expect(formatTierWindowLabel(1)).toBe("1 day");
    expect(formatTierWindowLabel(14)).toBe("14 days");
  });
});

describe("getTierWindowStartDate", () => {
  it("returns a date offset by N days from provided now", () => {
    const now = new Date("2026-02-24T12:00:00.000Z").getTime();
    const start = getTierWindowStartDate(14, now);
    expect(start.toISOString()).toBe("2026-02-10T12:00:00.000Z");
  });
});
