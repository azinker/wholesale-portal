import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
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
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#a1a1aa;line-height:1.5;">
              <p style="margin:0 0 6px 0;">&copy; ${year} The Perfect Part, LLC. All rights reserved.</p>
              <p style="margin:0 0 6px 0;">
                <a href="https://wholesale.theperfectpart.net" style="color:#71717a;text-decoration:underline;">Wholesale Portal</a>
                &nbsp;&middot;&nbsp;
                <a href="https://theperfectpart.net" style="color:#71717a;text-decoration:underline;">Shop</a>
              </p>
              <p style="margin:0;color:#d4d4d8;font-size:11px;">
                You received this email because you have an account with The Perfect Part wholesale program.
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
}: {
  logLabel: string;
  to: MailRecipient;
  subject: string;
  bodyHtml: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net";
    if (!apiKey) {
      console.error(`${logLabel} skipped: RESEND_API_KEY is not set`);
      return;
    }

    const { data, error } = await getResend().emails.send({
      from,
      to,
      replyTo,
      subject,
      html: brandedEmail(bodyHtml),
      text,
    });

    if (error) {
      console.error(`Failed to send ${logLabel}:`, error);
    } else if (data?.id) {
      console.log(`${logLabel} sent to ${Array.isArray(to) ? to.join(", ") : to}, Resend id: ${data.id}`);
    }
  } catch (err) {
    console.error(`${logLabel} failed:`, err);
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
    from: process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net",
    to: email,
    subject: "Sign in to your wholesale dashboard — The Perfect Part",
    html,
    text,
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
    const from = process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net";
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
      subject: "Your wholesale account has been approved — The Perfect Part",
      html,
      text,
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
    const from = process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net";
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
      subject: "Wholesale application update - The Perfect Part",
      html,
      text,
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

export async function sendSupportConfirmation(to: string, subject: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "no-reply@wholesale.theperfectpart.net";

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
    subject: "We received your support request — The Perfect Part",
    html,
    text,
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
  primaryState?: string;
  customerId?: number | null;
};

const SOURCE_LABELS: Record<NewApplicantPayload["source"], string> = {
  portal: "Wholesale Portal",
  webhook: "BigCommerce (webhook)",
  admin: "Admin (enrolled)",
};

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
      ...(payload.reapplied ? [["Application type", "Reapplication"]] : []),
      ...(payload.previousDenialReason ? [["Previous denial reason", payload.previousDenialReason]] : []),
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

    const heading = payload.reapplied ? "Wholesale Reapplication" : "New Wholesale Applicant";
    const subjectLabel = payload.reapplied ? "Reapplication" : "New applicant";

    console.log(`Sending ${subjectLabel.toLowerCase()} notification to ${WHOLESALE_NOTIFY} for ${payload.companyName} (${payload.source})`);
    const { data, error } = await resend.emails.send({
      from,
      to: WHOLESALE_NOTIFY,
      replyTo: payload.email,
      subject: `[Wholesale] ${subjectLabel}: ${payload.companyName}`,
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

  const text = `${inviterEmail} has invited you to join ${companyName}'s wholesale team on The Perfect Part.\n\nYour role: ${role}\n\nAccept the invitation: ${loginUrl}\n\nThis link expires in 15 minutes.`;

  return { html, text };
}
