import { z } from "zod";

export const PARTNER_TYPES = ["DROPSHIPPER", "AFFILIATE_PUBLISHER"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

const commonApplicationFields = {
  partnerType: z.enum(PARTNER_TYPES).default("DROPSHIPPER"),
  email: z.string().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  primaryState: z.string().trim().optional().default(""),
  attestation: z.literal(true, {
    errorMap: () => ({ message: "You must accept the attestation" }),
  }),
};

const dropshipperApplicationSchema = z.object({
  ...commonApplicationFields,
  partnerType: z.literal("DROPSHIPPER").default("DROPSHIPPER"),
  legalName: z.string().trim().optional().default(""),
  businessAddress: z.string().trim().min(1),
  website: z.string().trim().optional().default(""),
});

const publisherApplicationSchema = z.object({
  ...commonApplicationFields,
  partnerType: z.literal("AFFILIATE_PUBLISHER"),
  primaryState: z.string().trim().min(1),
  legalName: z.string().trim().optional().default(""),
  businessAddress: z.string().trim().optional().default(""),
  website: z.string().trim().optional().default(""),
  promoWebsite: z.string().trim().url("Enter a valid promotion website URL"),
  promoTypes: z.array(z.string().trim().min(1)).min(1, "Select at least one promotion type"),
  promoDescription: z.string().trim().min(1),
  audienceReach: z.string().trim().optional().default(""),
  awinJoined: z.boolean(),
  awinPublisherId: z.string().trim().optional().default(""),
}).superRefine((data, ctx) => {
  if (data.awinJoined && !data.awinPublisherId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["awinPublisherId"],
      message: "AWIN publisher ID is required when already joined",
    });
  }
});

export const applySchema = z.union([
  dropshipperApplicationSchema,
  publisherApplicationSchema,
]);

export type ApplicationInput = z.infer<typeof applySchema>;

export function isPublisher(partnerType: string | null | undefined): boolean {
  return partnerType === "AFFILIATE_PUBLISHER";
}
