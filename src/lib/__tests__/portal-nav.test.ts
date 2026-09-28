import { describe, expect, it } from "vitest";
import { getPortalNav } from "../portal-nav";

describe("getPortalNav", () => {
  it("preserves every reseller navigation route", () => {
    expect(getPortalNav("DROPSHIPPER", "APPROVED").map((item) => item.href)).toEqual([
      "/dashboard", "/hot-sellers", "/orders", "/tracking", "/insights",
      "/margin-calculator", "/documents", "/profile", "/team", "/support", "/terms",
    ]);
  });

  it("hides reseller-only routes from publishers", () => {
    const hrefs = getPortalNav("AFFILIATE_PUBLISHER", "APPROVED").map((item) => item.href);
    expect(hrefs).toContain("/performance");
    expect(hrefs).toContain("/share-kit");
    expect(hrefs).not.toContain("/orders");
    expect(hrefs).not.toContain("/tracking");
    expect(hrefs).not.toContain("/margin-calculator");
    expect(hrefs).not.toContain("/documents");
    expect(hrefs).not.toContain("/team");
  });

  it("defaults unknown and legacy accounts to reseller navigation", () => {
    expect(getPortalNav(undefined, "APPROVED").some((item) => item.href === "/orders")).toBe(true);
  });

  it("shows the shopify channel only for approved dropshippers when enabled", () => {
    const hrefs = getPortalNav("DROPSHIPPER", "APPROVED", true).map((item) => item.href);
    expect(hrefs).toContain("/catalog");
    expect(hrefs).toContain("/billing");
    expect(hrefs).toContain("/my-shopify");
    expect(hrefs).not.toContain("/hot-sellers");
    expect(getPortalNav("AFFILIATE_PUBLISHER", "APPROVED", true).some((item) => item.href === "/catalog")).toBe(false);
    expect(getPortalNav("DROPSHIPPER", "PENDING", true).some((item) => item.href === "/catalog")).toBe(false);
  });
});
