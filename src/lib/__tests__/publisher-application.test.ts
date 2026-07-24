import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/partner-types";

const validPublisher = {
  partnerType: "AFFILIATE_PUBLISHER",
  email: "publisher@example.com",
  firstName: "Pat",
  lastName: "Publisher",
  companyName: "Parts Media",
  phone: "555-0100",
  primaryState: "MI",
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
});
