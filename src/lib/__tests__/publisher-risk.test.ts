import { describe, expect, it } from "vitest";
import {
  checkPublisherRedemptionBurst,
  PUBLISHER_BURST_THRESHOLD_PER_HOUR,
} from "@/lib/risk-detection";

describe("publisher redemption burst risk", () => {
  it("flags many redemptions in one hour without treating sharing as abuse", () => {
    const now = new Date("2026-07-24T18:00:00.000Z");
    const dates = Array.from(
      { length: PUBLISHER_BURST_THRESHOLD_PER_HOUR + 1 },
      () => new Date("2026-07-24T17:30:00.000Z")
    );
    const result = checkPublisherRedemptionBurst(dates, now);
    expect(result.detected).toBe(true);
    expect(result.details.sharingAllowed).toBe(true);
  });
});
