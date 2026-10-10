import { describe, expect, it } from "vitest";
import { atLeastOneBusinessDayLater, easternMonthKey, expectedShipLabel } from "../shopify-channel/calendar";
import { decidePaidOrder } from "../shopify-channel/decide";
import { plainWarehouseFailure } from "../email";
import { quoteChannelCharge, shippingForCountry, warehouseCountry, wholesaleUnitCost } from "../shopify-channel/money";
import { csvCell, plainText } from "../shopify-channel/catalog-export";
import { chooseDropshipperCustomerId } from "../shopify-channel/customer";
import { zipStore } from "../shopify-channel/zip-store";
import { scrubListingText } from "../shopify-channel/scrub";

describe("expected ship date", () => {
  it("ships a weekend order on the next weekday", () => {
    expect(expectedShipLabel(new Date("2026-10-10T06:58:00Z"))).toBe("Monday, October 12");
  });

  it("ships a morning weekday order that same day", () => {
    expect(expectedShipLabel(new Date("2026-10-09T14:00:00Z"))).toBe("Friday, October 9");
  });
});

describe("shopify channel money", () => {
  it("charges tier cost plus one international shipping amount", () => {
    expect(wholesaleUnitCost(20, 25)).toBe(15);
    expect(shippingForCountry("US")).toBe(0);
    expect(warehouseCountry("US")).toEqual({ country: "United States", countryIso2: "US" });
    expect(warehouseCountry("United States").country).toBe("United States");
    expect(plainWarehouseFailure("The field 'country' is invalid.")).toMatch(/United States/);
    expect(plainWarehouseFailure("BC API POST https://api.example.com/orders failed")).not.toMatch(/https:/);
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

describe("dropshipper customer match", () => {
  it("keeps a stored customer only when the email is the wholesale account", () => {
    expect(
      chooseDropshipperCustomerId(
        "azforcefed@gmail.com",
        { id: 8, email: "Azforcefed@gmail.com" },
        { id: 2, email: "viswanathan.n@gmail.com" }
      )
    ).toBe(8);
  });

  it("replaces a mismatched stored customer with the email match", () => {
    expect(
      chooseDropshipperCustomerId(
        "azforcefed@gmail.com",
        { id: 2, email: "viswanathan.n@gmail.com" },
        { id: 8, email: "azforcefed@gmail.com" }
      )
    ).toBe(8);
  });

  it("refuses to file an order under a customer with a different email", () => {
    expect(() =>
      chooseDropshipperCustomerId(
        "azforcefed@gmail.com",
        { id: 2, email: "viswanathan.n@gmail.com" },
        null
      )
    ).toThrow(/not linked/);
  });
});

describe("listing export file", () => {
  it("keeps spreadsheet cells from breaking and leaves markup out of descriptions", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("=SUM(1)")).toBe("'=SUM(1)");
    expect(plainText("<p>Soft&nbsp;brace</p>")).toBe("Soft brace");
    const zip = zipStore([{ name: "listings.csv", data: Buffer.from("a") }]);
    expect(zip.subarray(0, 2).toString()).toBe("PK");
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
