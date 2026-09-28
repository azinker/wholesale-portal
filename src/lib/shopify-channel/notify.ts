import { Resend } from "resend";
import { env } from "@/lib/env";
import { WHOLESALE_NOTICE_EMAIL } from "./constants";

function mailer() {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  return { resend: new Resend(RESEND_API_KEY), from: EMAIL_FROM };
}

export async function emailAccount(to: string, subject: string, text: string): Promise<void> {
  const { resend, from } = mailer();
  await resend.emails.send({
    from,
    to,
    subject,
    text,
  });
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
