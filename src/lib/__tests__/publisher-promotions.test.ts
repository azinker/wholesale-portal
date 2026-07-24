import { describe, expect, it } from "vitest";
import {
  buildPublisherCouponPromotionBody,
  formatPublisherCouponCode,
} from "@/lib/bigcommerce/publisher-promotions";

describe("publisher promotions", () => {
  it("is guest eligible and excludes wholesale shipping/group rules", () => {
    const body = buildPublisherCouponPromotionBody({
      code: "PUB-ACME-P15-ABC123",
      discountPercent: 15,
    });

    expect(body.customer).toEqual({});
    expect(body).not.toHaveProperty("customer.group_ids");
    expect(JSON.stringify(body)).not.toContain("free_shipping");
    expect(body.redemption_type).toBe("COUPON");
  });

  it("formats a public publisher code with its tier", () => {
    expect(formatPublisherCouponCode("Acme Parts", "P20")).toMatch(
      /^PUB-ACME-PARTS-P20-[A-Z2-9]{6}$/
    );
  });
});
