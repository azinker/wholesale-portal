import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Resend + inbox providers prefer a human From display name over bare
 * "no-reply@" addresses, which Outlook often treats as junk.
 * Format: "The Perfect Part <partners@wholesale.theperfectpart.net>"
 */
function getEmailFrom(): string {
  const raw =
    process.env.EMAIL_FROM?.trim() ||
    "partners@wholesale.theperfectpart.net";

  if (raw.includes("<") && raw.includes(">")) {
    return raw;
  }

  const name =
    process.env.EMAIL_FROM_NAME?.trim() || "The Perfect Part";
  return `${name} <${raw}>`;
}

function getEmailReplyTo(): string | undefined {
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  return replyTo || undefined;
}

function getCompanyMailingAddress(): string {
  return (
    process.env.COMPANY_MAILING_ADDRESS?.trim() ||
    "The Perfect Part, LLC - 1407 SW 10TH AVE, POMPANO BEACH, FL 33069, USA"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND_RED = "#B8282E";
const BRAND_DARK = "#141414";

/**
 * Wraps email body content in a branded, table-based HTML template.
 * Uses inline styles only for maximum email client compatibility.
 * Includes anti-spam best practices: plain structure, low image-to-text
 * ratio, physical address, unsubscribe hint, and proper MIME headers.
 */
function brandedEmail(bodyHtml: string): string {
  const logoUrl = "https://wholesale.theperfectpart.net/logo.png";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
  <title>The Perfect Part</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding:0 0 32px 0;">
              <a href="https://wholesale.theperfectpart.net" style="text-decoration:none;">
                <img src="${logoUrl}" alt="The Perfect Part" width="180" height="44" style="display:block;border:0;outline:none;max-width:180px;height:auto;" />
              </a>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
              <!-- Red accent bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:4px;background-color:${BRAND_RED};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
              <!-- Body content -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 32px 28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#3f3f46;">
                    ${bodyHtml}
                    ${supportBlock()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#a1a1aa;line-height:1.5;">
              <p style="margin:0 0 6px 0;">&copy; ${year} The Perfect Part, LLC. All rights reserved.</p>
              <p style="margin:0 0 6px 0;color:#71717a;">${escapeHtml(getCompanyMailingAddress())}</p>
              <p style="margin:0 0 6px 0;">
                <a href="https://wholesale.theperfectpart.net" style="color:#71717a;text-decoration:underline;">Wholesale Portal</a>
                &nbsp;&middot;&nbsp;
                <a href="https://theperfectpart.net" style="color:#71717a;text-decoration:underline;">Shop</a>
              </p>
              <p style="margin:0;color:#d4d4d8;font-size:11px;">
                You received this email because you have an account with The Perfect Part partner program.
                This is a transactional message about your account — not a marketing newsletter.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function supportPageUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  return `${appUrl.replace(/\/$/, "")}/support`;
}

function withSupportText(text: string): string {
  return `${text}\n\nHave a problem? Contact Support. We reply the same business day, or within 1 business day.\n${supportPageUrl()}`;
}

function supportBlock(): string {
  return `<hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 16px 0;" />
<p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:${BRAND_DARK};">Have a problem?</p>
<p style="margin:0 0 12px 0;font-size:14px;color:#3f3f46;">Contact Support. We reply the same business day, or within 1 business day.</p>
${ctaButton(supportPageUrl(), "Contact Support")}`;
}

/** Reusable CTA button */
function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="background-color:${BRAND_RED};border-radius:8px;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

/** Small info box (red-tinted) */
function infoBox(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;">
  <tr>
    <td style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#3f3f46;">
      ${html}
    </td>
  </tr>
</table>`;
}

// ─────────────────────────────────────────────────────────────────
type MailRecipient = string | string[];

async function sendBrandedEmail({
  logLabel,
  to,
  subject,
  bodyHtml,
  text,
  replyTo,
  throwOnError = false,
}: {
  logLabel: string;
  to: MailRecipient;
  subject: string;
  bodyHtml: string;
  text: string;
  replyTo?: string;
  throwOnError?: boolean;
}): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = getEmailFrom();
    if (!apiKey) {
      const error = new Error(`${logLabel} skipped: RESEND_API_KEY is not set`);
      console.error(error.message);
      if (throwOnError) throw error;
      return;
    }

    const { data, error } = await getResend().emails.send({
      from,
      to,
      replyTo: replyTo || getEmailReplyTo(),
      subject,
      html: brandedEmail(bodyHtml),
      text: withSupportText(text),
    });

    if (error) {
      console.error(`Failed to send ${logLabel}:`, error);
      if (throwOnError) {
        throw new Error(
          `Failed to send ${logLabel}: ${error.message || "unknown Resend error"}`
        );
      }
    } else if (data?.id) {
      console.log(`${logLabel} sent to ${Array.isArray(to) ? to.join(", ") : to}, Resend id: ${data.id}`);
    }
  } catch (err) {
    console.error(`${logLabel} failed:`, err);
    if (throwOnError) throw err;
  }
}

function formatList(items: string[]): string {
  return `<ul style="padding-left:20px;margin:12px 0 0 0;">${items
    .map((item) => `<li style="margin:4px 0;">${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function tierLabel(tier: string): string {
  if (tier === "NONE") return "No active wholesale discount";
  if (tier === "WELCOME") return "Welcome discount";
  return tier;
}

// 1. SIGN-IN LINK (sent to customer)
// ─────────────────────────────────────────────────────────────────

export async function sendMagicLink(email: string, token: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const html = brandedEmail(`
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Sign In to Your Dashboard</h1>
    <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">The Perfect Part &mdash; Wholesale Portal</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
    <p>Click the button below to securely sign in to your wholesale account. This link expires in 15&nbsp;minutes.</p>
    ${ctaButton(verifyUrl, "Sign In to Portal")}
    <p style="font-size:13px;color:#a1a1aa;margin:0;">
      If you didn&rsquo;t request this, you can safely ignore this email. No action is needed.
    </p>
  `);

  const text = `Sign in to your wholesale dashboard at The Perfect Part.\n\nClick here to sign in: ${verifyUrl}\n\nThis link expires in 15 minutes. If you didn't request this, ignore this email.`;

  const { error } = await getResend().emails.send({
    from: getEmailFrom(),
    to: email,
    replyTo: getEmailReplyTo(),
    subject: "Sign in to your partner dashboard — The Perfect Part",
    html,
    text: withSupportText(text),
  });

  if (error) {
    console.error("Failed to send sign-in link:", error);
    throw new Error("Failed to send email");
  }
}

// ─────────────────────────────────────────────────────────────────
// 2. APPROVAL EMAIL (sent to customer)
// ─────────────────────────────────────────────────────────────────

export async function sendApplicantApprovalEmail(to: string, companyName: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = getEmailFrom();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
    if (!apiKey) {
      console.error("Applicant approval email skipped: RESEND_API_KEY is not set");
      return;
    }
    const resend = getResend();
    const safeName = escapeHtml(companyName || "your business");
    const loginUrl = `${appUrl}/login`;

    const html = brandedEmail(`
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">You&rsquo;re Approved!</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">Welcome to The Perfect Part Wholesale Program</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Great news &mdash; the wholesale account for <strong>${safeName}</strong> has been approved.</p>
      <p>Sign in to your wholesale portal to:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;">
        <tr><td style="padding:4px 0;font-size:15px;color:#3f3f46;">&#10003;&nbsp;&nbsp;View your unique coupon code</td></tr>
        <tr><td style="padding:4px 0;font-size:15px;color:#3f3f46;">&#10003;&nbsp;&nbsp;Track your tier progress &amp; discounts</td></tr>
        <tr><td style="padding:4px 0;font-size:15px;color:#3f3f46;">&#10003;&nbsp;&nbsp;Place orders with free shipping</td></tr>
        <tr><td style="padding:4px 0;font-size:15px;color:#3f3f46;">&#10003;&nbsp;&nbsp;Manage your account &amp; team</td></tr>
      </table>
      ${ctaButton(loginUrl, "Sign In to Your Portal")}
      ${infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">How to get your discount at checkout</p>
        <p style="margin:0;">When shopping on <strong>theperfectpart.net</strong>, sign in with <strong>${escapeHtml(to)}</strong> before checkout. Then enter your wholesale coupon code (found on your portal dashboard) to receive your discount, free shipping, and tax-free pricing.</p>
      `)}
      <p style="font-size:13px;color:#a1a1aa;margin:20px 0 0 0;">
        Questions? Sign in and visit the Support page, or reply to this email.
      </p>
    `);

    const text = `Great news — your wholesale account for ${companyName} has been approved at The Perfect Part!\n\nSign in to your portal: ${loginUrl}\n\nImportant: When shopping on theperfectpart.net, sign in with ${to} and enter your coupon code at checkout for your discount, free shipping, and tax-free pricing.\n\nYour coupon code is available on your portal dashboard after signing in.`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      replyTo: getEmailReplyTo(),
      subject: "Your wholesale account has been approved — The Perfect Part",
      html,
      text: withSupportText(text),
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

// ─────────────────────────────────────────────────────────────────
// 2B. DENIAL EMAIL (sent to customer)
export async function sendApplicantDenialEmail(to: string, companyName: string, reason: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = getEmailFrom();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
    if (!apiKey) {
      console.error("Applicant denial email skipped: RESEND_API_KEY is not set");
      return;
    }

    const resend = getResend();
    const safeName = escapeHtml(companyName || "your business");
    const safeReason = escapeHtml(reason);
    const reapplyUrl = `${appUrl}/?reapply=1`;

    const html = brandedEmail(`
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Wholesale Application Update</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">The Perfect Part Wholesale Program</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Thank you for applying to the wholesale program for <strong>${safeName}</strong>.</p>
      <p>We were not able to approve this application as submitted.</p>
      ${infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">Reason provided by our review team</p>
        <p style="margin:0;">${safeReason}</p>
      `)}
      <p style="margin:20px 0 0 0;">You can update your information and reapply at any time. A new submission will return your application to review.</p>
      ${ctaButton(reapplyUrl, "Update and Reapply")}
      <p style="font-size:13px;color:#a1a1aa;margin:0;">
        If you have questions, sign in to the wholesale portal and contact Support.
      </p>
    `);

    const text = `Your wholesale application for ${companyName} was not approved as submitted.\n\nReason: ${reason}\n\nYou can update your information and reapply here: ${reapplyUrl}\n\nIf you have questions, sign in to the wholesale portal and contact Support.`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      replyTo: getEmailReplyTo(),
      subject: "Wholesale application update - The Perfect Part",
      html,
      text: withSupportText(text),
    });

    if (error) {
      console.error("Failed to send applicant denial email:", error);
    } else if (data?.id) {
      console.log(`Applicant denial email sent to ${to}, Resend id: ${data.id}`);
    }
  } catch (err) {
    console.error("Applicant denial email failed:", err);
  }
}

// 2C. APPLICATION STATUS EMAILS (sent to customer)
export async function sendApplicationReceivedEmail(to: string, companyName: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Application received email",
    to,
    subject: "We received your wholesale application - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Application Received</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">The Perfect Part Wholesale Program</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Thanks for applying for <strong>${escapeHtml(companyName)}</strong>. We received your wholesale application and our team will review it.</p>
      <p>Most applications are reviewed within 1 business day. We will email you when your application is approved, denied, or if we need more information.</p>
      ${ctaButton(`${appUrl}/login`, "Check Application Status")}
    `,
    text: `We received your wholesale application for ${companyName}.\n\nMost applications are reviewed within 1 business day. Check your status: ${appUrl}/login`,
  });
}

export async function sendPublisherApplicationReceivedEmail(to: string, companyName: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Publisher application received email",
    to,
    subject: "We received your publisher application - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Publisher Application Received</h1>
      <p>Thanks for applying for <strong>${escapeHtml(companyName)}</strong>. Our team will review your promotion methods and AWIN details.</p>
      <p>Most applications are reviewed within 1 business day.</p>
      ${ctaButton(`${appUrl}/login`, "Check Application Status")}
    `,
    text: `We received your affiliate publisher application for ${companyName}.\n\nCheck your status: ${appUrl}/login`,
  });
}

export async function sendPublisherApprovalEmail(
  to: string,
  companyName: string,
  code: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const awinUrl = "https://ui.awin.com/merchant-profile/121802";
  await sendBrandedEmail({
    logLabel: "Publisher approval email",
    to,
    subject: "Your publisher account has been approved - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">You&rsquo;re Approved!</h1>
      <p>The publisher account for <strong>${escapeHtml(companyName)}</strong> is approved.</p>
      ${infoBox(`<p style="margin:0 0 6px 0;"><strong>Audience code:</strong> ${escapeHtml(code)}</p><p style="margin:0;"><strong>Audience discount:</strong> 15%</p>`)}
      <p>Promote your AWIN tracking link together with this audience code. The link attributes commission; the code gives your audience the discount.</p>
      ${ctaButton(awinUrl, "Open AWIN Merchant Profile")}
      ${ctaButton(`${appUrl}/dashboard`, "Open Publisher Portal")}
    `,
    text: `Your publisher account for ${companyName} is approved.\n\nAudience code: ${code} (15% off)\nUse it together with your AWIN tracking link for merchant 121802.\n\nPortal: ${appUrl}/dashboard\nAWIN: ${awinUrl}`,
  });
}

export async function sendPublisherDenialEmail(to: string, companyName: string, reason: string): Promise<void> {
  await sendBrandedEmail({
    logLabel: "Publisher denial email",
    to,
    subject: "Publisher application update - The Perfect Part",
    bodyHtml: `<h1 style="color:${BRAND_DARK};">Publisher Application Update</h1><p>We could not approve the application for <strong>${escapeHtml(companyName)}</strong> as submitted.</p>${infoBox(`<p style="margin:0;">${escapeHtml(reason)}</p>`)}`,
    text: `Your publisher application for ${companyName} was not approved.\n\nReason: ${reason}`,
  });
}

export async function sendPublisherMoreInfoRequestEmail(to: string, companyName: string, message: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Publisher more info request email",
    to,
    subject: "More information needed for your publisher application - The Perfect Part",
    bodyHtml: `<h1 style="color:${BRAND_DARK};">More Information Needed</h1><p>We need more information to review <strong>${escapeHtml(companyName)}</strong>.</p>${infoBox(`<p style="margin:0;">${escapeHtml(message)}</p>`)}${ctaButton(`${appUrl}/login`, "Sign In to Respond")}`,
    text: `We need more information for your publisher application for ${companyName}.\n\n${message}\n\n${appUrl}/login`,
  });
}

export async function sendReapplicationReceivedEmail(to: string, companyName: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Reapplication received email",
    to,
    subject: "We received your updated wholesale application - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Updated Application Received</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">The Perfect Part Wholesale Program</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Thanks for updating the wholesale application for <strong>${escapeHtml(companyName)}</strong>.</p>
      <p>Your application is back in review. We will email you when a decision is made or if we need anything else.</p>
      ${ctaButton(`${appUrl}/login`, "Check Application Status")}
    `,
    text: `We received your updated wholesale application for ${companyName}.\n\nYour application is back in review. Check your status: ${appUrl}/login`,
  });
}

export async function sendApplicantMoreInfoRequestEmail(to: string, companyName: string, message: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Applicant more info request email",
    to,
    subject: "More information needed for your wholesale application - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">More Information Needed</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">The Perfect Part Wholesale Program</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>We are reviewing the wholesale application for <strong>${escapeHtml(companyName)}</strong>, but we need a little more information before making a decision.</p>
      ${infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">Reviewer note</p>
        <p style="margin:0;">${escapeHtml(message)}</p>
      `)}
      <p style="margin:20px 0 0 0;">Sign in to upload documents, update your profile, or contact Support with the requested details.</p>
      ${ctaButton(`${appUrl}/login`, "Sign In to Respond")}
    `,
    text: `We need more information for your wholesale application for ${companyName}.\n\nReviewer note: ${message}\n\nSign in to respond: ${appUrl}/login`,
  });
}

// 3. SUPPORT CONFIRMATION (sent to customer)
// ─────────────────────────────────────────────────────────────────

/** Turn a warehouse error into a sentence a wholesaler can read. */
export function plainWarehouseFailure(message: string): string {
  const text = message.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  if (/country/i.test(text) && /invalid/i.test(text)) {
    return "The shipping country was sent as a short code, such as US. The warehouse needs the full name, United States. The address your customer typed can still be a normal US address. This happened on our side when we handed the order over.";
  }
  if (/phone/i.test(text) && /invalid|required|missing/i.test(text)) {
    return "The warehouse needed a phone number before it could start this shipment.";
  }
  if (text && text.length < 180 && !/bigcommerce|api post|\{"status"/i.test(text)) {
    return text;
  }
  return "The warehouse could not start the shipment. The charge was refunded so you are not paying for an order we did not ship.";
}

export async function sendChannelRefundEmail(input: {
  to: string;
  orderName: string;
  orderId: string;
  amount: number;
  reason: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const supportUrl = `${appUrl}/support?category=shopify_order_change&order=${encodeURIComponent(input.orderName)}`;
  const orderUrl = `${appUrl}/my-shopify/orders/${input.orderId}`;
  const amount = `$${input.amount.toFixed(2)}`;
  const why = plainWarehouseFailure(input.reason);
  const safeOrder = escapeHtml(input.orderName);
  const safeWhy = escapeHtml(why);

  await sendBrandedEmail({
    logLabel: "channel refund",
    to: input.to,
    subject: `We refunded ${input.orderName} — The Perfect Part`,
    throwOnError: false,
    text: [
      `We refunded ${input.orderName}. Nothing shipped.`,
      ``,
      `Your customer paid you on Shopify. We charged your card ${amount} so we could ship the order. The warehouse could not start the shipment, so we refunded that charge right away.`,
      ``,
      `What went wrong`,
      why,
      ``,
      `Your statement should show a charge and a refund for ${amount}. They may both say Pending for a little while. They cancel each other out.`,
      ``,
      `Open the order: ${orderUrl}`,
      `Contact Support in your dashboard: ${supportUrl}`,
      `Support is also in the menu on the left after you sign in.`,
    ].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">We refunded this order</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${safeOrder} &mdash; nothing shipped</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Your customer paid you on Shopify. We charged your card <strong>${amount}</strong> so we could ship the order. The warehouse could not start the shipment, so we refunded that charge right away.</p>
      ${infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">What went wrong</p>
        <p style="margin:0;">${safeWhy}</p>
      `)}
      <p>On your statement you should see a charge and a refund for the same <strong>${amount}</strong>. They may both say Pending for a little while. They cancel each other out.</p>
      <p>If you want us to look at this order, use Support in your dashboard. That sends a note straight to our team. Support is the menu on the left after you sign in.</p>
      ${ctaButton(supportUrl, "Contact Support")}
      <p style="font-size:13px;color:#a1a1aa;margin:0;">
        Or open the order in your portal:
        <a href="${escapeHtml(orderUrl)}" style="color:#71717a;text-decoration:underline;">${safeOrder}</a>
      </p>
    `,
  });
}

function detailBlock(rows: Array<{ label: string; html: string }>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#f6f3f1;border-radius:12px;">
    ${rows
      .map(
        (row, index) => `<tr><td style="padding:${index === 0 ? "16px" : "0"} 16px ${index === rows.length - 1 ? "16px" : "12px"} 16px;">
      <p style="font-size:12px;font-weight:600;color:#71717a;margin:0 0 2px 0;text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(row.label)}</p>
      <p style="font-size:15px;color:${BRAND_DARK};margin:0;line-height:1.5;">${row.html}</p>
    </td></tr>`
      )
      .join("")}
  </table>`;
}

export async function sendChannelChargedEmail(input: {
  to: string;
  orderName: string;
  orderId: string;
  lines: Array<{ title: string; quantity: number; unitCost: number }>;
  shipping: number;
  total: number;
  last4: string;
  shipTo: { name: string; street: string; street2?: string; city: string; province: string; zip: string; country: string };
  warehouseId: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const orderUrl = `${appUrl}/my-shopify/orders/${input.orderId}`;
  const money = (value: number) => `$${value.toFixed(2)}`;
  const products = input.lines
    .map((line) => `${line.title} × ${line.quantity} — ${money(line.unitCost)}`)
    .join("\n");
  const address = [
    input.shipTo.name,
    input.shipTo.street,
    input.shipTo.street2 || "",
    [input.shipTo.city, input.shipTo.province, input.shipTo.zip].filter(Boolean).join(" "),
    input.shipTo.country,
  ].filter((line) => line.trim().length > 0);
  const productHtml = input.lines
    .map((line) => `${escapeHtml(line.title)} &times; ${line.quantity} &mdash; ${money(line.unitCost)}`)
    .join("<br>");
  const addressHtml = address.map((line) => escapeHtml(line)).join("<br>");

  await sendBrandedEmail({
    logLabel: "channel charged",
    to: input.to,
    subject: `We charged ${input.orderName} — The Perfect Part`,
    throwOnError: false,
    text: [
      `${input.orderName} is charged and on its way to the warehouse.`,
      "",
      "Your customer paid you on Shopify. We charged your card and will ship the order.",
      "",
      "Products",
      products,
      `Shipping: ${money(input.shipping)}`,
      `Total charged: ${money(input.total)}`,
      `Card ending ${input.last4}. It shows on your statement as THE PERFECT PART.`,
      "",
      "Ship to",
      address.join("\n"),
      "",
      `Warehouse order ${input.warehouseId}. We ship the same day or the next business day.`,
      `See it in your portal: ${orderUrl}`,
    ].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">We charged your card</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(input.orderName)} is on its way</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Your customer paid you on Shopify. We charged your card and sent the order to the warehouse. We ship the same day or the next business day.</p>
      ${detailBlock([
        { label: "Products", html: productHtml },
        { label: "Shipping", html: money(input.shipping) },
        { label: "Total charged", html: `<strong>${money(input.total)}</strong>` },
        { label: "Card", html: `Ending ${escapeHtml(input.last4)}. It shows on your statement as <strong>THE PERFECT PART</strong>.` },
        { label: "Ship to", html: addressHtml },
        { label: "Warehouse", html: `Order ${input.warehouseId}` },
      ])}
      ${ctaButton(orderUrl, "See this order")}
    `,
  });
}

export async function sendChannelAttentionEmail(input: {
  to: string;
  orderName: string;
  reason: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const copy = attentionCopy(input.reason, input.orderName);
  await sendBrandedEmail({
    logLabel: "channel attention",
    to: input.to,
    subject: `${copy.subject} — The Perfect Part`,
    throwOnError: false,
    text: [copy.headline, "", copy.body, "", copy.next, "", `Open your portal: ${appUrl}${copy.path}`].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">${escapeHtml(copy.headline)}</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(input.orderName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>${escapeHtml(copy.body)}</p>
      ${infoBox(`<p style="margin:0;">${escapeHtml(copy.next)}</p>`)}
      ${ctaButton(`${appUrl}${copy.path}`, copy.button)}
    `,
  });
}

function attentionCopy(reason: string, orderName: string): { subject: string; headline: string; body: string; next: string; button: string; path: string } {
  if (reason === "store_paused") {
    return {
      subject: `${orderName} came in while the store is paused`,
      headline: "We did not charge this one",
      body: `${orderName} came in while this store is paused. Your customer paid you on Shopify. We saw the order, and we did not charge your card or ship it.`,
      next: "You can refund them on Shopify, or handle the sale yourself. Turning the store back on later does not ship this one.",
      button: "Open My stores",
      path: "/my-shopify",
    };
  }
  if (reason === "incomplete_address") {
    return {
      subject: `${orderName} needs an address`,
      headline: "The address is missing a piece",
      body: `${orderName} is missing a street or a country. We did not charge your card.`,
      next: "Add the address on that Shopify order. Then we will charge your card and ship it.",
      button: "Open orders",
      path: "/my-shopify/orders",
    };
  }
  if (reason === "missing_phone") {
    return {
      subject: `${orderName} needs a phone number`,
      headline: "This shipment needs a phone number",
      body: `${orderName} is outside the US and needs a phone number. We did not charge your card.`,
      next: "Add a phone number on that Shopify order. Then we will charge your card and ship it.",
      button: "Open orders",
      path: "/my-shopify/orders",
    };
  }
  if (reason === "out_of_stock") {
    return {
      subject: `${orderName} is out of stock`,
      headline: "We don't have enough to ship",
      body: `${orderName} doesn't have enough stock. We did not charge your card, and we will not ship it.`,
      next: "You can refund your customer on Shopify.",
      button: "Open orders",
      path: "/my-shopify/orders",
    };
  }
  if (reason === "needs_retest") {
    return {
      subject: `${orderName} is waiting on the store`,
      headline: "We still need to confirm the store",
      body: `${orderName} came in before we confirmed shipping for that store. We did not charge your card.`,
      next: "Open My stores and we'll check the address.",
      button: "Open My stores",
      path: "/my-shopify",
    };
  }
  if (reason === "card_declined") {
    return {
      subject: `${orderName} was not charged`,
      headline: "The card did not go through",
      body: `We could not charge the card on file for ${orderName}. Nothing shipped.`,
      next: "Save a working card in Billing. We will retry the oldest unpaid order.",
      button: "Update the card",
      path: "/billing",
    };
  }
  return {
    subject: `${orderName} needs a card`,
    headline: "A card is needed before we can ship",
    body: `${orderName} needs a working card before we can ship. Nothing was charged.`,
    next: "Save a card in Billing and we will pick this up.",
    button: "Add a card",
    path: "/billing",
  };
}

export async function sendChannelCardReminderEmail(input: { to: string; orderName: string }): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "channel card reminder",
    to: input.to,
    subject: `${input.orderName} still needs a card — The Perfect Part`,
    throwOnError: false,
    text: [
      `${input.orderName} is still unpaid on our side.`,
      "",
      "Save a working credit card in Billing and we will retry it. We do not close this for you.",
      "",
      `Billing: ${appUrl}/billing`,
    ].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">This sale is still waiting</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(input.orderName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Your customer paid you on Shopify. We still have not charged a card, so nothing has shipped.</p>
      <p>Save a working card in Billing and we will retry it. We do not close this for you.</p>
      ${ctaButton(`${appUrl}/billing`, "Update the card")}
    `,
  });
}

export async function sendChannelShippedEmail(input: {
  to: string;
  orderName: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const orderUrl = `${appUrl}/my-shopify/orders/${input.orderId}`;
  await sendBrandedEmail({
    logLabel: "channel shipped",
    to: input.to,
    subject: `${input.orderName} shipped — The Perfect Part`,
    throwOnError: false,
    text: [
      `${input.orderName} shipped.`,
      `${input.carrier} ${input.trackingNumber}`,
      "",
      "Your Shopify store emails your customer. This note is for you.",
      `See it: ${orderUrl}`,
    ].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">It's on the way</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(input.orderName)} shipped</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>The warehouse handed this order to the carrier. Your Shopify store emails your customer. This note is for you.</p>
      ${detailBlock([
        { label: "Carrier", html: escapeHtml(input.carrier || "Carrier") },
        { label: "Tracking", html: escapeHtml(input.trackingNumber) },
      ])}
      ${ctaButton(orderUrl, "See this order")}
    `,
  });
}

export async function sendListingsStoppedEmail(input: {
  to: string;
  shopDomain: string;
  added: number;
  skipped: number;
  failed: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "listings stopped",
    to: input.to,
    subject: "Adding products stopped — The Perfect Part",
    throwOnError: false,
    text: [
      `${input.shopDomain} was disconnected, so we stopped adding products.`,
      `Added: ${input.added}`,
      `Already on the store: ${input.skipped}`,
      `Not added: ${input.failed}`,
      "",
      "Products already on the store stay there. Stock updates for that store have stopped.",
      `My stores: ${appUrl}/my-shopify`,
    ].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Adding products stopped</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(input.shopDomain)} was disconnected</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>We stopped the rest of that add. Products already on the store stay there. Stock updates for that store have stopped.</p>
      ${detailBlock([
        { label: "Added", html: String(input.added) },
        { label: "Already there", html: String(input.skipped) },
        { label: "Not added", html: String(input.failed) },
      ])}
      ${ctaButton(`${appUrl}/my-shopify`, "Open My stores")}
    `,
  });
}

export async function sendAdminChannelRefundEmail(input: {
  to: string;
  orderName: string;
  orderId: string;
  amount: number;
  warehouseStatus: "cancelled" | "refunded" | "partial" | "unchanged";
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const orderUrl = `${appUrl}/my-shopify/orders/${input.orderId}`;
  const amount = `$${input.amount.toFixed(2)}`;
  const shipment = input.warehouseStatus === "cancelled"
    ? "We marked the warehouse order Cancelled, so this one will not go out."
    : input.warehouseStatus === "refunded"
      ? "We marked the warehouse order Refunded. It had already shipped, so the package can still be on the way. This refund is only the wholesale charge on your card."
      : input.warehouseStatus === "partial"
        ? "We marked the warehouse order Partially Refunded."
        : "We refunded your card. The warehouse order status could not be updated. If it has not shipped and you need it stopped, contact Support.";
  const customer = "This does not refund the customer who placed the order on your Shopify store. Their payment stays with you until you refund them in Shopify.";
  const safeOrder = escapeHtml(input.orderName);
  await sendBrandedEmail({
    logLabel: "admin channel refund",
    to: input.to,
    subject: `We refunded ${input.orderName} — The Perfect Part`,
    throwOnError: false,
    text: [
      `We refunded ${amount} on ${input.orderName}.`,
      ``,
      `Your customer paid you on Shopify. We had charged your card so we could ship the order. Our team refunded that wholesale charge back to your card.`,
      ``,
      shipment,
      ``,
      customer,
      ``,
      `Open the order: ${orderUrl}`,
    ].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">We refunded your card</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${safeOrder} &mdash; ${amount} is going back to your card</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Your customer paid you on Shopify. We had charged your card so we could ship the order. Our team refunded that wholesale charge.</p>
      ${infoBox(`<p style="margin:0 0 8px 0;">${escapeHtml(shipment)}</p><p style="margin:0;"><strong>${escapeHtml(customer)}</strong></p>`)}
      <p>On your statement you should see the refund for <strong>${amount}</strong>. It may say Pending for a little while.</p>
      ${ctaButton(orderUrl, "Open this order")}
    `,
  });
}

export async function sendCatalogExportEmail(input: {
  to: string;
  count: number;
  exportId: string;
  couponCode?: string | null;
  format?: string | null;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const downloadUrl = `${appUrl}/export?ready=${encodeURIComponent(input.exportId)}`;
  const countLabel = `${input.count} product${input.count === 1 ? "" : "s"}`;
  const formatName = input.format === "shopify"
    ? "Shopify"
    : input.format === "bigcommerce"
      ? "BigCommerce"
      : input.format === "woocommerce"
        ? "WooCommerce"
        : "Manual";
  const formatText = formatName === "Manual"
    ? "The spreadsheet is the Manual format. It is a simple file, not tied to one website."
    : `The spreadsheet uses ${formatName} product import columns. Import it from that site's product import page.`;
  const code = input.couponCode?.trim() || "";
  const couponText = code
    ? `Your coupon right now is ${code}. Enter that code at checkout.`
    : `Your coupon shows on your wholesale dashboard once your account qualifies. Enter that code at checkout.`;
  const couponHtml = code
    ? `<p style="margin:0;">Your coupon right now is <strong style="font-family:ui-monospace,monospace;">${escapeHtml(code)}</strong>. Enter that code at checkout.</p>`
    : `<p style="margin:0;">Your coupon shows on your wholesale dashboard once your account qualifies. Enter that code at checkout.</p>`;
  await sendBrandedEmail({
    logLabel: "catalog export",
    to: input.to,
    subject: "Your product export is ready — The Perfect Part",
    throwOnError: false,
    text: [
      `Your export of ${countLabel} is ready.`,
      ``,
      `This file is for putting the catalog on your own site. It does not connect orders. A sale on your site does not order from us by itself.`,
      formatText,
      ``,
      `When a customer buys from you, place that order on www.theperfectpart.net. Sign in with ${input.to}, the same email as your wholesale dashboard, then enter your coupon.`,
      couponText,
      ``,
      `The zip has listings.csv, how-to-use.csv, and an images folder. Inside images, each product has its own folder named with the product title.`,
      `Your SKU column is blank on purpose. Type your own SKU before you import the file.`,
      ``,
      `Download it after you sign in: ${downloadUrl}`,
    ].join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Your product export is ready</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${countLabel}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>This file is for putting the catalog on your own site. It does not connect orders. A sale on your site does not order from us by itself.</p>
      <p>${escapeHtml(formatText)}</p>
      <p>When a customer buys from you, place that order on <strong>www.theperfectpart.net</strong>. Sign in with <strong>${escapeHtml(input.to)}</strong>, the same email as your wholesale dashboard, then enter your coupon.</p>
      ${infoBox(couponHtml)}
      <p>The zip has three things: <strong>listings.csv</strong>, <strong>how-to-use.csv</strong>, and an <strong>images</strong> folder. Open images and each product has its own folder, named with the product title. That product's pictures are inside.</p>
      <p>Your SKU column is blank on purpose. Type your own SKU before you import the file.</p>
      <p>Sign in with this same email, then download the file. The link stays on your Export listings page.</p>
      ${ctaButton(downloadUrl, "Download the export")}
    `,
  });
}

export async function sendListingAddedEmail(input: {
  to: string;
  added: number;
  skipped: number;
  failed: number;
  edits: Array<{ title: string; sku: string; price: string }>;
  errors: Array<{ title: string; message: string }>;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const listUrl = `${appUrl}/catalog?view=added`;
  const untouched = Math.max(0, input.added - input.edits.length);
  const editLines = input.edits.slice(0, 40).map((row) => `${row.title} — price ${row.price}${row.sku && row.sku !== "No SKU" ? `, SKU ${row.sku}` : ", no SKU"}`);
  const errorLines = input.errors.slice(0, 15).map((row) => `${row.title}: ${row.message}`);
  const subject = input.failed > 0 ? "Some products could not be added — The Perfect Part" : "Your products are on Shopify — The Perfect Part";
  await sendBrandedEmail({
    logLabel: "listing added",
    to: input.to,
    subject,
    throwOnError: false,
    text: [
      input.failed > 0 ? "We finished adding your products. Some could not be added." : "Your products are on your Shopify store.",
      "",
      `Added: ${input.added}`,
      `Already on your store: ${input.skipped}`,
      `Could not add: ${input.failed}`,
      "",
      input.edits.length
        ? `You set a price or SKU on ${input.edits.length} product${input.edits.length === 1 ? "" : "s"}:\n${editLines.join("\n")}`
        : "You left the price at retail and the SKU blank on every product.",
      untouched > 0 && input.edits.length ? `\nThe other ${untouched} added product${untouched === 1 ? "" : "s"} used the retail price and no SKU.` : "",
      errorLines.length ? `\nCould not add:\n${errorLines.join("\n")}` : "",
      "",
      `See them: ${listUrl}`,
    ].filter((line) => line !== undefined).join("\n"),
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Your products are on Shopify</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">Added ${input.added} · Already there ${input.skipped} · Not added ${input.failed}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      ${input.edits.length ? `<p>You set a price or SKU on <strong>${input.edits.length}</strong> product${input.edits.length === 1 ? "" : "s"}.</p><ul style="padding-left:18px;">${editLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : `<p>You left the price at retail and the SKU blank on every product.</p>`}
      ${untouched > 0 && input.edits.length ? `<p>The other <strong>${untouched}</strong> added product${untouched === 1 ? "" : "s"} used the retail price and no SKU.</p>` : ""}
      ${errorLines.length ? `<p>These could not be added:</p><ul style="padding-left:18px;">${errorLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
      ${ctaButton(listUrl, "See products on your store")}
    `,
  });
}

export async function sendSupportConfirmation(to: string, subject: string): Promise<void> {
  const from = getEmailFrom();

  const html = brandedEmail(`
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">We Got Your Message</h1>
    <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">Support Request Received</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
    <p>Thank you for reaching out. We&rsquo;ve received your support request and will get back to you as soon as possible.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#f4f4f5;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="font-size:12px;font-weight:600;color:#71717a;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;">Subject</p>
          <p style="font-size:15px;font-weight:600;color:${BRAND_DARK};margin:0;">${escapeHtml(subject)}</p>
        </td>
      </tr>
    </table>
    <p>If you have additional details to share, simply reply to this email or submit another ticket from the Support page in your portal.</p>
    <p style="font-size:13px;color:#a1a1aa;margin:20px 0 0 0;">
      Our team typically responds within 1 business day.
    </p>
  `);

  const text = `We received your support request.\n\nSubject: ${subject}\n\nWe'll get back to you as soon as possible. If you have additional details, reply to this email or submit another ticket from the Support page.\n\nOur team typically responds within 1 business day.`;

  const { error } = await getResend().emails.send({
    from,
    to,
    replyTo: getEmailReplyTo(),
    subject: "We received your support request — The Perfect Part",
    html,
    text: withSupportText(text),
  });
  if (error) {
    console.error("Failed to send support confirmation email:", error);
  }
}

// ─────────────────────────────────────────────────────────────────
// 3B. DOCUMENT EMAILS (sent to customer)
export async function sendDocumentUploadedEmail(
  to: string,
  companyName: string,
  filename: string,
  docType?: string | null
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Document uploaded email",
    to,
    subject: "Document uploaded - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Document Uploaded</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>We received your document upload.</p>
      ${infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">Uploaded file</p>
        <p style="margin:0;">${escapeHtml(filename)}${docType ? ` (${escapeHtml(docType)})` : ""}</p>
      `)}
      <p style="margin:20px 0 0 0;">You can review your uploaded documents in the wholesale portal.</p>
      ${ctaButton(`${appUrl}/documents`, "View Documents")}
    `,
    text: `We received your document upload for ${companyName}.\n\nFile: ${filename}${docType ? ` (${docType})` : ""}\n\nView documents: ${appUrl}/documents`,
  });
}

export async function sendDocumentIssueEmail(
  to: string,
  companyName: string,
  filename: string,
  issue: "rejected" | "scan_failed",
  detail: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const title = issue === "rejected" ? "Document Not Accepted" : "Document Scan Failed";
  const summary =
    issue === "rejected"
      ? "We could not accept one of your uploaded documents."
      : "We could not finish scanning one of your uploaded documents.";

  await sendBrandedEmail({
    logLabel: "Document issue email",
    to,
    subject: `${title} - The Perfect Part`,
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">${title}</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>${summary}</p>
      ${infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">File</p>
        <p style="margin:0 0 8px 0;">${escapeHtml(filename)}</p>
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">Details</p>
        <p style="margin:0;">${escapeHtml(detail)}</p>
      `)}
      <p style="margin:20px 0 0 0;">Please sign in and upload a replacement document or contact Support if you need help.</p>
      ${ctaButton(`${appUrl}/documents`, "Upload Replacement")}
    `,
    text: `${title} for ${companyName}.\n\nFile: ${filename}\nDetails: ${detail}\n\nUpload a replacement: ${appUrl}/documents`,
  });
}

// 3C. ACCOUNT CHANGE EMAILS (sent to customer)
export async function sendBusinessInfoChangeReviewedEmail(
  to: string,
  companyName: string,
  status: "APPROVED" | "DENIED",
  fields: string[],
  reviewNote?: string | null
): Promise<void> {
  const approved = status === "APPROVED";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const title = approved ? "Business Information Updated" : "Business Information Update Not Approved";
  await sendBrandedEmail({
    logLabel: "Business info change reviewed email",
    to,
    subject: `${title} - The Perfect Part`,
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">${title}</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>${approved ? "Your requested business information changes were approved and applied to your account." : "Your requested business information changes were reviewed but were not approved."}</p>
      ${fields.length ? infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">Reviewed fields</p>
        ${formatList(fields)}
      `) : ""}
      ${reviewNote ? `<p style="margin:20px 0 0 0;"><strong>Review note:</strong> ${escapeHtml(reviewNote)}</p>` : ""}
      ${ctaButton(`${appUrl}/profile`, "View Profile")}
    `,
    text: `${title} for ${companyName}.\n\nFields: ${fields.join(", ") || "Business information"}${reviewNote ? `\nReview note: ${reviewNote}` : ""}\n\nView profile: ${appUrl}/profile`,
  });
}

export async function sendTierChangedEmail(
  to: string,
  companyName: string,
  previousTier: string,
  newTier: string,
  count: number,
  windowDays: number,
  changeType: "achieved" | "downgraded"
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const achieved = changeType === "achieved";
  const title = achieved ? "New Wholesale Tier Achieved" : "Wholesale Tier Updated";
  await sendBrandedEmail({
    logLabel: "Tier changed email",
    to,
    subject: `${title} - The Perfect Part`,
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">${title}</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>${achieved ? "Good news - your recent order volume moved you into a new wholesale tier." : "Your wholesale tier changed based on your rolling order volume."}</p>
      ${infoBox(`
        <p style="margin:0 0 6px 0;"><strong>Previous tier:</strong> ${escapeHtml(tierLabel(previousTier))}</p>
        <p style="margin:0 0 6px 0;"><strong>Current tier:</strong> ${escapeHtml(tierLabel(newTier))}</p>
        <p style="margin:0;"><strong>Qualifying orders:</strong> ${count} in the last ${windowDays} days</p>
      `)}
      <p style="margin:20px 0 0 0;">Your portal shows your current tier, progress, and any active coupon code.</p>
      ${ctaButton(`${appUrl}/dashboard`, "View Dashboard")}
    `,
    text: `${title} for ${companyName}.\n\nPrevious tier: ${tierLabel(previousTier)}\nCurrent tier: ${tierLabel(newTier)}\nQualifying orders: ${count} in the last ${windowDays} days\n\nView dashboard: ${appUrl}/dashboard`,
  });
}

export async function sendPublisherTierChangedEmail(
  to: string,
  companyName: string,
  previousTier: string,
  newTier: string,
  count: number,
  code: string,
  discount: number
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Publisher tier changed email",
    to,
    subject: "Your publisher audience code changed - The Perfect Part",
    bodyHtml: `
      <h1 style="color:${BRAND_DARK};">Update Your Published Code</h1>
      <p><strong>${escapeHtml(companyName)}</strong> moved from ${escapeHtml(previousTier)} to ${escapeHtml(newTier)} based on ${count} attributed orders in 14 days.</p>
      ${infoBox(`<p style="margin:0 0 6px 0;"><strong>New code:</strong> ${escapeHtml(code)}</p><p style="margin:0;"><strong>Audience discount:</strong> ${discount}%</p>`)}
      <p>The old code is disabled. Update every site, offer, and social placement immediately.</p>
      ${ctaButton(`${appUrl}/dashboard`, "View Current Code")}
    `,
    text: `Your publisher tier changed from ${previousTier} to ${newTier}.\nNew code: ${code} (${discount}% off)\nThe old code is disabled; update your offers immediately.\n\n${appUrl}/dashboard`,
    throwOnError: true,
  });
}

export const sendPublisherCouponChangedEmail = sendPublisherTierChangedEmail;

export async function sendWelcomeDiscountExpiringEmail(
  to: string,
  companyName: string,
  expiresAt: Date,
  discount: number
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  const expires = expiresAt.toLocaleString("en-US", { timeZone: "America/New_York" });
  await sendBrandedEmail({
    logLabel: "Welcome discount expiring email",
    to,
    subject: "Your welcome discount is expiring soon - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Welcome Discount Expiring Soon</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Your ${discount}% welcome discount is almost finished.</p>
      ${infoBox(`
        <p style="font-weight:600;color:#991B1B;margin:0 0 8px 0;">Expiration</p>
        <p style="margin:0;">${escapeHtml(expires)} ET</p>
      `)}
      <p style="margin:20px 0 0 0;">Place eligible orders before it expires to use the welcome discount and build your regular wholesale tier.</p>
      ${ctaButton("https://theperfectpart.net", "Shop Now")}
    `,
    text: `Your ${discount}% welcome discount for ${companyName} is expiring soon.\n\nExpiration: ${expires} ET\n\nShop now: https://theperfectpart.net\nPortal: ${appUrl}/dashboard`,
  });
}

// 3D. COUPON EMAILS (sent to customer)
export async function sendCouponCreatedEmail(
  to: string,
  companyName: string,
  code: string,
  tier: string,
  discount: number
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Coupon created email",
    to,
    subject: "Your wholesale coupon is ready - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Your Coupon Is Ready</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Your wholesale coupon code is ready to use.</p>
      ${infoBox(`
        <p style="margin:0 0 6px 0;"><strong>Code:</strong> ${escapeHtml(code)}</p>
        <p style="margin:0;"><strong>Discount:</strong> ${discount}% (${escapeHtml(tierLabel(tier))})</p>
      `)}
      <p style="margin:20px 0 0 0;">Sign in to theperfectpart.net with your registered wholesale email and enter this code at checkout.</p>
      ${ctaButton(`${appUrl}/dashboard`, "View Coupon")}
    `,
    text: `Your wholesale coupon is ready for ${companyName}.\n\nCode: ${code}\nDiscount: ${discount}% (${tierLabel(tier)})\n\nView coupon: ${appUrl}/dashboard`,
  });
}

export async function sendCouponChangedEmail(
  to: string,
  companyName: string,
  previousTier: string,
  newTier: string,
  code: string,
  discount: number
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Coupon changed email",
    to,
    subject: "Your wholesale coupon changed - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Your Coupon Changed</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>Your active wholesale coupon changed because your tier changed.</p>
      ${infoBox(`
        <p style="margin:0 0 6px 0;"><strong>Previous tier:</strong> ${escapeHtml(tierLabel(previousTier))}</p>
        <p style="margin:0 0 6px 0;"><strong>Current tier:</strong> ${escapeHtml(tierLabel(newTier))}</p>
        <p style="margin:0 0 6px 0;"><strong>Current code:</strong> ${escapeHtml(code)}</p>
        <p style="margin:0;"><strong>Discount:</strong> ${discount}%</p>
      `)}
      ${ctaButton(`${appUrl}/dashboard`, "View Current Coupon")}
    `,
    text: `Your wholesale coupon changed for ${companyName}.\n\nPrevious tier: ${tierLabel(previousTier)}\nCurrent tier: ${tierLabel(newTier)}\nCurrent code: ${code}\nDiscount: ${discount}%\n\nView current coupon: ${appUrl}/dashboard`,
  });
}

export async function sendCouponDisabledEmail(
  to: string,
  companyName: string,
  code: string,
  reason: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Coupon disabled email",
    to,
    subject: "Your wholesale coupon was disabled - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Coupon Disabled</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>One of your wholesale coupon codes is no longer active.</p>
      ${infoBox(`
        <p style="margin:0 0 6px 0;"><strong>Code:</strong> ${escapeHtml(code)}</p>
        <p style="margin:0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
      `)}
      ${ctaButton(`${appUrl}/dashboard`, "View Dashboard")}
    `,
    text: `Your wholesale coupon was disabled for ${companyName}.\n\nCode: ${code}\nReason: ${reason}\n\nView dashboard: ${appUrl}/dashboard`,
  });
}

// 3E. TEAM EMAILS (sent to account owner/member)
export async function sendTeamMemberAddedEmail(
  to: MailRecipient,
  companyName: string,
  memberEmail: string,
  role: string,
  actorEmail: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Team member added email",
    to,
    subject: "Team member added - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Team Member Added</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p><strong>${escapeHtml(memberEmail)}</strong> was added to your wholesale team.</p>
      ${infoBox(`
        <p style="margin:0 0 6px 0;"><strong>Role:</strong> ${escapeHtml(role)}</p>
        <p style="margin:0;"><strong>Added by:</strong> ${escapeHtml(actorEmail)}</p>
      `)}
      ${ctaButton(`${appUrl}/team`, "View Team")}
    `,
    text: `${memberEmail} was added to ${companyName}'s wholesale team.\n\nRole: ${role}\nAdded by: ${actorEmail}\n\nView team: ${appUrl}/team`,
  });
}

export async function sendTeamMemberRemovedEmail(
  to: MailRecipient,
  companyName: string,
  memberEmail: string,
  actorEmail: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Team member removed email",
    to,
    subject: "Team member removed - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Team Member Removed</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p><strong>${escapeHtml(memberEmail)}</strong> was removed from the wholesale team.</p>
      ${infoBox(`<p style="margin:0;"><strong>Removed by:</strong> ${escapeHtml(actorEmail)}</p>`)}
      ${ctaButton(`${appUrl}/team`, "View Team")}
    `,
    text: `${memberEmail} was removed from ${companyName}'s wholesale team by ${actorEmail}.\n\nView team: ${appUrl}/team`,
  });
}

export async function sendTeamMemberRoleChangedEmail(
  to: MailRecipient,
  companyName: string,
  memberEmail: string,
  previousRole: string,
  newRole: string,
  actorEmail: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net";
  await sendBrandedEmail({
    logLabel: "Team member role changed email",
    to,
    subject: "Team member role changed - The Perfect Part",
    bodyHtml: `
      <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">Team Role Changed</h1>
      <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">${escapeHtml(companyName)}</p>
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
      <p>The role for <strong>${escapeHtml(memberEmail)}</strong> was changed.</p>
      ${infoBox(`
        <p style="margin:0 0 6px 0;"><strong>Previous role:</strong> ${escapeHtml(previousRole)}</p>
        <p style="margin:0 0 6px 0;"><strong>New role:</strong> ${escapeHtml(newRole)}</p>
        <p style="margin:0;"><strong>Changed by:</strong> ${escapeHtml(actorEmail)}</p>
      `)}
      ${ctaButton(`${appUrl}/team`, "View Team")}
    `,
    text: `The team role changed for ${memberEmail} on ${companyName}.\n\nPrevious role: ${previousRole}\nNew role: ${newRole}\nChanged by: ${actorEmail}\n\nView team: ${appUrl}/team`,
  });
}

// 4. NEW APPLICANT NOTIFICATION (sent to admin)
// ─────────────────────────────────────────────────────────────────

const WHOLESALE_NOTIFY = "wholesale@theperfectpart.net";

export type NewApplicantPayload = {
  email: string;
  companyName: string;
  alias: string;
  source: "portal" | "webhook" | "admin";
  reapplied?: boolean;
  previousDenialReason?: string | null;
  firstName?: string;
  lastName?: string;
  legalName?: string;
  businessAddress?: string;
  phone?: string;
  website?: string;
  country?: string;
  primaryState?: string;
  customerId?: number | null;
  partnerType?: "DROPSHIPPER" | "AFFILIATE_PUBLISHER";
  promoWebsite?: string;
  promoTypes?: string[];
  promoDescription?: string;
  audienceReach?: string;
  awinPublisherId?: string;
};

const SOURCE_LABELS: Record<NewApplicantPayload["source"], string> = {
  portal: "Wholesale Portal",
  webhook: "BigCommerce (webhook)",
  admin: "Admin (enrolled)",
};

export async function sendNewApplicantNotification(payload: NewApplicantPayload): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = getEmailFrom();
    if (!apiKey) {
      console.error("New applicant notification skipped: RESEND_API_KEY is not set");
      return;
    }
    const resend = new Resend(apiKey);
    const sourceLabel = SOURCE_LABELS[payload.source] ?? payload.source;
    const rows = [
      ["Partner type", payload.partnerType === "AFFILIATE_PUBLISHER" ? "Affiliate Publisher" : "Drop shipper / Reseller"],
      ["Email", payload.email],
      ["Company", payload.companyName],
      ["Alias", payload.alias],
      ["Source", sourceLabel],
      ...(payload.reapplied ? [["Application type", "Reapplication"]] : []),
      ...(payload.previousDenialReason ? [["Previous denial reason", payload.previousDenialReason]] : []),
      ...(payload.customerId != null ? [["BC Customer ID", `#${payload.customerId}`]] : []),
      ...(payload.firstName ? [["First name", payload.firstName]] : []),
      ...(payload.lastName ? [["Last name", payload.lastName]] : []),
      ...(payload.legalName ? [["Legal name", payload.legalName]] : []),
      ...(payload.businessAddress ? [["Business address", payload.businessAddress]] : []),
      ...(payload.phone ? [["Phone", payload.phone]] : []),
      ...(payload.website ? [["Website", payload.website]] : []),
      ...(payload.country ? [["Country", payload.country]] : []),
      ...(payload.primaryState ? [["Primary state", payload.primaryState]] : []),
      ...(payload.promoWebsite ? [["Promotion website", payload.promoWebsite]] : []),
      ...(payload.promoTypes?.length ? [["Promotion types", payload.promoTypes.join(", ")]] : []),
      ...(payload.promoDescription ? [["Promotion description", payload.promoDescription]] : []),
      ...(payload.audienceReach ? [["Audience reach", payload.audienceReach]] : []),
      ...(payload.awinPublisherId ? [["AWIN publisher ID", payload.awinPublisherId]] : []),
    ];
    const tableRows = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333; width: 140px;">${escapeHtml(label)}</td><td style="padding: 6px 0;">${escapeHtml(String(value))}</td></tr>`
      )
      .join("");

    const partnerLabel = payload.partnerType === "AFFILIATE_PUBLISHER" ? "Publisher" : "Wholesale";
    const heading = payload.reapplied ? `${partnerLabel} Reapplication` : `New ${partnerLabel} Applicant`;
    const subjectLabel = payload.reapplied ? "Reapplication" : "New applicant";

    console.log(`Sending ${subjectLabel.toLowerCase()} notification to ${WHOLESALE_NOTIFY} for ${payload.companyName} (${payload.source})`);
    const { data, error } = await resend.emails.send({
      from,
      to: WHOLESALE_NOTIFY,
      replyTo: payload.email,
      subject: `[${partnerLabel}] ${subjectLabel}: ${payload.companyName}`,
      html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 0;">
        <div style="background: #2d2d2d; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0 0 4px 0; font-size: 18px;">${heading}</h2>
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
      text: `${heading}: ${payload.companyName}\nEmail: ${payload.email}\nSource: ${sourceLabel}${payload.previousDenialReason ? `\nPrevious denial reason: ${payload.previousDenialReason}` : ""}\n\nReview at: ${(process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net") + "/admin/applicants"}`,
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

// ─────────────────────────────────────────────────────────────────
// 5. TEAM INVITE — branded template builder (used by team API route)
// ─────────────────────────────────────────────────────────────────

export function buildTeamInviteHtml(
  inviterEmail: string,
  companyName: string,
  role: string,
  loginUrl: string,
): { html: string; text: string } {
  const html = brandedEmail(`
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_DARK};">You&rsquo;ve Been Invited</h1>
    <p style="margin:0 0 4px 0;color:#71717a;font-size:14px;">Join a wholesale team on The Perfect Part</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;" />
    <p><strong>${escapeHtml(inviterEmail)}</strong> has invited you to join <strong>${escapeHtml(companyName)}</strong>&rsquo;s wholesale team.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#f4f4f5;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="font-size:12px;font-weight:600;color:#71717a;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;">Your Role</p>
          <p style="font-size:15px;font-weight:600;color:${BRAND_DARK};margin:0;">${escapeHtml(role)}</p>
        </td>
      </tr>
    </table>
    <p>Click below to accept the invitation and access the wholesale portal. This link expires in 15&nbsp;minutes.</p>
    ${ctaButton(loginUrl, "Accept Invitation")}
    <p style="font-size:13px;color:#a1a1aa;margin:0;">
      If you weren&rsquo;t expecting this, you can safely ignore this email.
    </p>
  `);

  const text = withSupportText(`${inviterEmail} has invited you to join ${companyName}'s wholesale team on The Perfect Part.\n\nYour role: ${role}\n\nAccept the invitation: ${loginUrl}\n\nThis link expires in 15 minutes.`);

  return { html, text };
}
