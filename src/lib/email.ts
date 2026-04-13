import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendMagicLink(email: string, token: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net",
    to: email,
    subject: "Sign in to The Perfect Part Wholesale Portal",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111; margin-bottom: 8px;">Wholesale Portal Login</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Click the button below to sign in to your wholesale account at
          <strong>The Perfect Part</strong>. This link expires in 15 minutes.
        </p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #111; color: #fff; padding: 12px 28px;
                  border-radius: 6px; text-decoration: none; font-size: 15px; margin: 16px 0;">
          Sign In
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.<br/>
          Link: <a href="${verifyUrl}" style="color: #888;">${verifyUrl}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send magic link:", error);
    throw new Error("Failed to send email");
  }
}

/** Send a confirmation to the user that their support request was received. Does not throw; logs on failure. */
export async function sendSupportConfirmation(to: string, subject: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net";
  const { error } = await getResend().emails.send({
    from,
    to,
    subject: "We received your support request — The Perfect Part",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111; margin-bottom: 8px;">Support request received</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          We got your message and will get back to you as soon as we can.
        </p>
        <p style="color: #333; font-size: 14px; margin: 16px 0 0 0;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          If you have more details, reply to this email or submit another ticket from the Support page in the wholesale portal.
        </p>
      </div>
    `,
  });
  if (error) {
    console.error("Failed to send support confirmation email:", error);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const WHOLESALE_NOTIFY = "wholesale@theperfectpart.net";

export type NewApplicantPayload = {
  email: string;
  companyName: string;
  alias: string;
  source: "portal" | "webhook" | "admin";
  firstName?: string;
  lastName?: string;
  legalName?: string;
  businessAddress?: string;
  phone?: string;
  website?: string;
  primaryState?: string;
  customerId?: number | null;
};

const SOURCE_LABELS: Record<NewApplicantPayload["source"], string> = {
  portal: "Wholesale Portal",
  webhook: "BigCommerce (webhook)",
  admin: "Admin (enrolled)",
};

/** Send approval email to the applicant when their wholesale account is approved. Does not throw; logs on failure. */
export async function sendApplicantApprovalEmail(to: string, companyName: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
    if (!apiKey) {
      console.error("Applicant approval email skipped: RESEND_API_KEY is not set");
      return;
    }
    const resend = getResend();
    const safeName = escapeHtml(companyName || "your business");
    const loginUrl = `${appUrl}/login`;
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Your wholesale account has been approved — The Perfect Part",
      html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111; margin-bottom: 8px;">You're approved for wholesale</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Great news — your wholesale account for <strong>${safeName}</strong> has been approved at <strong>The Perfect Part</strong>.
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Sign in to the wholesale portal to view your coupon code, track your tier progress, and manage your account.
        </p>
        <a href="${escapeHtml(loginUrl)}"
           style="display: inline-block; background: #B8282E; color: #fff; padding: 12px 28px;
                  border-radius: 6px; text-decoration: none; font-size: 15px; margin: 16px 0;">
          Sign in to wholesale portal
        </a>
        <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="color: #991B1B; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
            Important: How to get your discount at checkout
          </p>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0;">
            When shopping on <strong>theperfectpart.net</strong>, make sure to <strong>sign in with this email address</strong> (${escapeHtml(to)}) before checkout. Then enter your wholesale coupon code at checkout to receive your discount, free shipping, and tax-free pricing.
          </p>
        </div>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          If you have any questions, contact us from the Support page after signing in.
        </p>
      </div>
    `,
    });
    if (error) {
      console.error("Failed to send applicant approval email:", error);
    } else if (data?.id) {
      console.log(`Applicant approval email sent to ${to}, Resend id: ${data.id}`);
    }
  } catch (err) {
    console.error("Applicant approval email failed:", err);
  }
}

/** Notify wholesale@ when a new applicant signs up. Does not throw; logs on failure. */
export async function sendNewApplicantNotification(payload: NewApplicantPayload): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net";
    if (!apiKey) {
      console.error("New applicant notification skipped: RESEND_API_KEY is not set");
      return;
    }
    const resend = new Resend(apiKey);
    const sourceLabel = SOURCE_LABELS[payload.source] ?? payload.source;
    const rows = [
      ["Email", payload.email],
      ["Company", payload.companyName],
      ["Alias", payload.alias],
      ["Source", sourceLabel],
      ...(payload.customerId != null ? [["BC Customer ID", `#${payload.customerId}`]] : []),
      ...(payload.firstName ? [["First name", payload.firstName]] : []),
      ...(payload.lastName ? [["Last name", payload.lastName]] : []),
      ...(payload.legalName ? [["Legal name", payload.legalName]] : []),
      ...(payload.businessAddress ? [["Business address", payload.businessAddress]] : []),
      ...(payload.phone ? [["Phone", payload.phone]] : []),
      ...(payload.website ? [["Website", payload.website]] : []),
      ...(payload.primaryState ? [["Primary state", payload.primaryState]] : []),
    ];
    const tableRows = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333; width: 140px;">${escapeHtml(label)}</td><td style="padding: 6px 0;">${escapeHtml(String(value))}</td></tr>`
      )
      .join("");

    console.log(`Sending new applicant notification to ${WHOLESALE_NOTIFY} for ${payload.companyName} (${payload.source})`);
    const { data, error } = await resend.emails.send({
      from,
      to: WHOLESALE_NOTIFY,
      subject: `[Wholesale] New applicant: ${payload.companyName}`,
      html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 0;">
        <div style="background: #2d2d2d; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0 0 4px 0; font-size: 18px;">New Wholesale Applicant</h2>
          <p style="margin: 0; font-size: 13px; opacity: 0.8;">Review and approve in the admin portal</p>
        </div>
        <div style="border: 1px solid #e5e0dd; border-top: 0; border-radius: 0 0 8px 8px; padding: 24px;">
          <table style="width: 100%; font-size: 13px; color: #555; border-collapse: collapse;">
            ${tableRows}
          </table>
          <p style="font-size: 12px; color: #999; margin: 20px 0 0 0;">Reply to this email to contact the applicant at ${escapeHtml(payload.email)}.</p>
          <p style="font-size: 12px; margin: 12px 0 0 0;"><a href="${escapeHtml((process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net") + "/admin/applicants")}" style="color: #B8282E;">Review applicants →</a></p>
        </div>
      </div>
    `,
    });
    if (error) {
      console.error("Failed to send new applicant notification:", error);
      console.error("Resend error detail:", typeof error === "object" && error !== null ? JSON.stringify(error) : String(error));
    } else if (data?.id) {
      console.log(`New applicant notification sent to ${WHOLESALE_NOTIFY}, Resend id: ${data.id}`);
    }
  } catch (err) {
    console.error("New applicant notification failed (config or send):", err);
  }
}
