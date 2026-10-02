import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/partner-types";

const validPublisher = {
  partnerType: "AFFILIATE_PUBLISHER",
  email: "publisher@example.com",
  firstName: "Pat",
  lastName: "Publisher",
  companyName: "Parts Media",
  phone: "555-0100",
  country: "United States",
  primaryState: "Michigan",
  attestation: true,
  promoWebsite: "https://publisher.example.com",
  promoTypes: ["blog"],
  promoDescription: "Automotive product reviews",
  awinJoined: true,
  awinPublisherId: "12345",
};

describe("publisher application schema", () => {
  it("accepts a valid publisher application", () => {
    expect(applySchema.safeParse(validPublisher).success).toBe(true);
  });

  it("rejects invalid promotion URLs", () => {
    expect(
      applySchema.safeParse({ ...validPublisher, promoWebsite: "not-a-url" }).success
    ).toBe(false);
  });

  it("accepts a publisher outside the United States without a state", () => {
    expect(
      applySchema.safeParse({ ...validPublisher, country: "Portugal", primaryState: "" }).success
    ).toBe(true);
  });

  it("rejects a US application without a state", () => {
    expect(
      applySchema.safeParse({ ...validPublisher, primaryState: "" }).success
    ).toBe(false);
  });
});

const validDropshipper = {
  partnerType: "DROPSHIPPER",
  email: "seller@example.com",
  firstName: "Ana",
  lastName: "Silva",
  companyName: "Lisbon Parts",
  phone: "+351 910000000",
  country: "Portugal",
  primaryState: "",
  attestation: true,
  businessAddress: "Lisbon, Portugal",
  website: "https://www.ebay.com/str/example",
};

describe("dropshipper application schema", () => {
  it("accepts an international dropshipper without a US state", () => {
    expect(applySchema.safeParse(validDropshipper).success).toBe(true);
  });

  it("still requires a state for a US dropshipper", () => {
    expect(
      applySchema.safeParse({ ...validDropshipper, country: "United States", businessAddress: "1 Main St" }).success
    ).toBe(false);
    expect(
      applySchema.safeParse({
        ...validDropshipper,
        country: "United States",
        primaryState: "Florida",
        businessAddress: "1 Main St",
      }).success
    ).toBe(true);
  });
});
