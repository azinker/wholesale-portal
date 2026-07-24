import { describe, it, expect } from "vitest";
import {
  buildWholesaleCouponPromotionBody,
  wholesalePromotionCustomerEligibility,
} from "../bigcommerce/wholesale-promotions";

describe("wholesalePromotionCustomerEligibility", () => {
  it("restricts promotions to the Wholesale customer group", () => {
    expect(wholesalePromotionCustomerEligibility(42)).toEqual({
      group_ids: [42],
    });
  });
});

describe("buildWholesaleCouponPromotionBody", () => {
  it("includes Wholesale group eligibility on coupon promotions", () => {
    const body = buildWholesaleCouponPromotionBody({
      code: "WS-ACME-T10-ABC123",
      discountPercent: 10,
      wholesaleGroupId: 7,
    });

    expect(body.customer).toEqual({ group_ids: [7] });
    expect(body.redemption_type).toBe("COUPON");
    expect(body.can_be_used_with_other_promotions).toBe(false);
  });
});
