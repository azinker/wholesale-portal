import { describe, it, expect } from "vitest";
import { tierFromCount, getTierConfig, TIERS, DEFAULT_TIERS } from "../tier-engine";

describe("tierFromCount", () => {
  it("returns NONE for 0 orders", async () => {
    expect(await tierFromCount(0)).toBe("NONE");
  });

  it("returns NONE for 4 orders", async () => {
    expect(await tierFromCount(4)).toBe("NONE");
  });

  it("returns T10 for exactly 5 orders", async () => {
    expect(await tierFromCount(5)).toBe("T10");
  });

  it("returns T10 for 24 orders", async () => {
    expect(await tierFromCount(24)).toBe("T10");
  });

  it("returns T15 for exactly 25 orders", async () => {
    expect(await tierFromCount(25)).toBe("T15");
  });

  it("returns T20 for exactly 50 orders", async () => {
    expect(await tierFromCount(50)).toBe("T20");
  });

  it("returns T25 for exactly 100 orders", async () => {
    expect(await tierFromCount(100)).toBe("T25");
  });

  it("returns T30 for 200+ orders", async () => {
    expect(await tierFromCount(200)).toBe("T30");
    expect(await tierFromCount(500)).toBe("T30");
  });
});

describe("getTierConfig", () => {
  it("returns config for T10", async () => {
    const config = await getTierConfig("T10");
    expect(config).toEqual({ id: "T10", label: "10% Off", minOrders: 5, discount: 10 });
  });

  it("returns config for T15", async () => {
    const config = await getTierConfig("T15");
    expect(config).toEqual({ id: "T15", label: "15% Off", minOrders: 25, discount: 15 });
  });

  it("returns config for T20", async () => {
    const config = await getTierConfig("T20");
    expect(config).toEqual({ id: "T20", label: "20% Off", minOrders: 50, discount: 20 });
  });

  it("returns null for NONE", async () => {
    expect(await getTierConfig("NONE")).toBeNull();
  });
});

describe("TIERS / DEFAULT_TIERS", () => {
  it("has 5 default tiers", () => {
    expect(DEFAULT_TIERS).toHaveLength(5);
  });

  it("TIERS alias equals DEFAULT_TIERS", () => {
    expect(TIERS).toEqual(DEFAULT_TIERS);
  });

  it("tiers are sorted by minOrders ascending", () => {
    for (let i = 1; i < DEFAULT_TIERS.length; i++) {
      expect(DEFAULT_TIERS[i].minOrders).toBeGreaterThan(DEFAULT_TIERS[i - 1].minOrders);
    }
  });
});
