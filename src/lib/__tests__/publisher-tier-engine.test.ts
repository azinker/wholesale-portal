import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLISHER_TIERS,
  publisherTierFromCount,
} from "@/lib/publisher-tier-engine";

describe("publisherTierFromCount", () => {
  it("never falls below the P15 floor", () => {
    expect(publisherTierFromCount(0)).toBe("P15");
    expect(publisherTierFromCount(-10)).toBe("P15");
  });

  it("upgrades at 50 and 125 attributed orders", () => {
    expect(publisherTierFromCount(49)).toBe("P15");
    expect(publisherTierFromCount(50)).toBe("P20");
    expect(publisherTierFromCount(124)).toBe("P20");
    expect(publisherTierFromCount(125)).toBe("P25");
  });

  it("downgrades only as far as P15", () => {
    expect(publisherTierFromCount(49, DEFAULT_PUBLISHER_TIERS)).toBe("P15");
  });
});
