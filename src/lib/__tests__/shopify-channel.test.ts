import { describe, expect, it } from "vitest";
import { atLeastOneBusinessDayLater, easternMonthKey } from "../shopify-channel/calendar";
import { decidePaidOrder } from "../shopify-channel/decide";
import { quoteChannelCharge, shippingForCountry, wholesaleUnitCost } from "../shopify-channel/money";
import { scrubListingText } from "../shopify-channel/scrub";

describe("shopify channel money", () => {
  it("charges tier cost plus one international shipping amount", () => {
    expect(wholesaleUnitCost(20, 25)).toBe(15);
    expect(shippingForCountry("US")).toBe(0);
    expect(shippingForCountry("CA")).toBe(18.99);
    const quote = quoteChannelCharge(
      [
        { retail: 20, quantity: 2, discountPercent: 25, salePrice: 40 },
        { retail: 10, quantity: 1, discountPercent: 25, salePrice: 12 },
      ],
      "Canada"
    );
    expect(quote.goods).toBe(37.5);
    expect(quote.shipping).toBe(18.99);
    expect(quote.total).toBe(56.49);
    expect(quote.soldFor).toBe(92);
  });
});

describe("shopify channel decisions", () => {
  const ready = {
    financialStatus: "paid",
    channelEnabled: true,
    storePaused: false,
    addressTestPassed: true,
    street: "1 Main",
    country: "US",
    phone: "",
    stockOk: true,
    hasCard: true,
  };

  it("ignores unpaid orders and queues while the channel is off", () => {
    expect(decidePaidOrder({ ...ready, financialStatus: "authorized" }).action).toBe("ignore");
    expect(decidePaidOrder({ ...ready, channelEnabled: false }).action).toBe("queue");
  });

  it("does not charge a paused store, a missing street, or a short stock order", () => {
    expect(decidePaidOrder({ ...ready, storePaused: true })).toEqual({ action: "hold", reason: "store_paused" });
    expect(decidePaidOrder({ ...ready, street: "" })).toEqual({ action: "hold", reason: "incomplete_address" });
    expect(decidePaidOrder({ ...ready, stockOk: false })).toEqual({ action: "hold", reason: "out_of_stock" });
    expect(decidePaidOrder({ ...ready, country: "CA", phone: "" })).toEqual({ action: "hold", reason: "missing_phone" });
  });
});

describe("eastern billing calendar", () => {
  it("keeps a late March evening in March and waits one weekday before a card reminder", () => {
    const lateMarch = new Date("2026-04-01T03:30:00Z");
    expect(easternMonthKey(lateMarch)).toBe("2026-03");
    const friday = new Date("2026-09-25T16:00:00Z");
    const saturday = new Date("2026-09-26T16:00:00Z");
    const monday = new Date("2026-09-28T14:00:00Z");
    expect(atLeastOneBusinessDayLater(friday, saturday)).toBe(false);
    expect(atLeastOneBusinessDayLater(friday, monday)).toBe(true);
    expect(atLeastOneBusinessDayLater(monday, monday)).toBe(false);
  });
});

describe("listing scrub", () => {
  it("removes the brand, site, and phone while keeping html", () => {
    const cleaned = scrubListingText("<b>The Perfect Part</b> brace theperfectpart.net call 954-555-0100");
    expect(cleaned.toLowerCase()).not.toContain("perfect part");
    expect(cleaned).not.toContain("theperfectpart.net");
    expect(cleaned).not.toContain("954-555-0100");
    expect(cleaned).toContain("<b>");
  });
});
