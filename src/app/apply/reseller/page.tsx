import type { Metadata } from "next";
import { PartnerApplicationForm } from "@/components/partner-application-form";

export const metadata: Metadata = {
  title: "Apply as a Reseller | The Perfect Part",
  description: "Apply for wholesale reseller pricing, tax-free purchasing, and drop-ship fulfillment.",
};

export default function ResellerApplicationPage() {
  return <PartnerApplicationForm partnerType="DROPSHIPPER" />;
}
