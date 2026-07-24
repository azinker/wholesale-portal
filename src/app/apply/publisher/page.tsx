import type { Metadata } from "next";
import { PartnerApplicationForm } from "@/components/partner-application-form";

export const metadata: Metadata = {
  title: "Apply as an Affiliate Publisher | The Perfect Part",
  description: "Apply to earn AWIN commission while sharing 15–25% audience discount codes.",
};

export default function PublisherApplicationPage() {
  return <PartnerApplicationForm partnerType="AFFILIATE_PUBLISHER" />;
}
