import { describe, expect, it } from "vitest";

import { isWholesaleFormValue } from "@/lib/bigcommerce/webhooks";

describe("isWholesaleFormValue", () => {
  it("accepts common truthy BC form field values", () => {
    expect(isWholesaleFormValue("yes")).toBe(true);
    expect(isWholesaleFormValue("YES")).toBe(true);
    expect(isWholesaleFormValue("true")).toBe(true);
    expect(isWholesaleFormValue("1")).toBe(true);
    expect(isWholesaleFormValue(1)).toBe(true);
    expect(isWholesaleFormValue(true)).toBe(true);
  });

  it("rejects empty or false values", () => {
    expect(isWholesaleFormValue("no")).toBe(false);
    expect(isWholesaleFormValue("0")).toBe(false);
    expect(isWholesaleFormValue(0)).toBe(false);
    expect(isWholesaleFormValue(false)).toBe(false);
    expect(isWholesaleFormValue(null)).toBe(false);
    expect(isWholesaleFormValue(undefined)).toBe(false);
  });
});
