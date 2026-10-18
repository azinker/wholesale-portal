import { Resend } from "resend";
import { env } from "@/lib/env";
import { WHOLESALE_NOTICE_EMAIL } from "./constants";

function mailer() {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  return { resend: new Resend(RESEND_API_KEY), from: EMAIL_FROM };
}

export async function emailWholesaleDesk(subject: string, text: string): Promise<void> {
  const { resend, from } = mailer();
  await resend.emails.send({
    from,
    to: WHOLESALE_NOTICE_EMAIL,
    subject,
    text,
  });
}

export async function emailShopifyStoreConnected(input: {
  companyName: string;
  email: string;
  shopDomain: string;
  reconnected: boolean;
  ready: boolean;
}): Promise<void> {
  const verb = input.reconnected ? "reconnected" : "connected";
  await emailWholesaleDesk(
    `Shopify store ${verb}: ${input.shopDomain}`,
    [
      `${input.companyName} ${verb} a Shopify store.`,
      `Store: ${input.shopDomain}`,
      `Account: ${input.companyName}`,
      `Email: ${input.email}`,
      `Status: ${input.ready ? "Ready" : "Connecting"}`,
    ].join("\n")
  );
}
