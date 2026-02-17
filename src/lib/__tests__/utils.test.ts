import { describe, it, expect } from "vitest";
import { toAlias, randomCode, formatCouponCode } from "../utils";

describe("toAlias", () => {
  it("converts a company name to uppercase alias", () => {
    expect(toAlias("The Perfect Part")).toBe("THE-PERFECT-PART");
  });

  it("removes special characters", () => {
    expect(toAlias("Bob's Auto & Parts!")).toBe("BOB-S-AUTO-PARTS");
  });

  it("truncates to 20 characters", () => {
    expect(toAlias("A Very Long Company Name That Exceeds Limit")).toBe("A-VERY-LONG-COMPANY-");
  });

  it("handles empty string", () => {
    expect(toAlias("")).toBe("");
  });
});

describe("randomCode", () => {
  it("generates a 6-character code by default", () => {
    const code = randomCode();
    expect(code).toHaveLength(6);
  });

  it("generates a code of specified length", () => {
    const code = randomCode(10);
    expect(code).toHaveLength(10);
  });

  it("only uses unambiguous characters", () => {
    for (let i = 0; i < 100; i++) {
      const code = randomCode(20);
      expect(code).not.toMatch(/[0OlI1]/);
    }
  });
});

describe("formatCouponCode", () => {
  it("formats code correctly", () => {
    const code = formatCouponCode("ACME", 10);
    expect(code).toMatch(/^WS-ACME-T10-[A-Z0-9]{6}$/);
  });
});
