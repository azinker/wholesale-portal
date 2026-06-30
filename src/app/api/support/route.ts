import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { sendSupportConfirmation } from "@/lib/email";
import { Resend } from "resend";
import { loadTierWindowDays } from "@/lib/tier-engine";
import { formatTierWindowLabel } from "@/lib/tier-window";

const URGENCY_LABELS: Record<string, string> = {
  low: "Low — General question",
  medium: "Medium — Needs attention soon",
  high: "High — Urgent issue",
  critical: "Critical — Order/Account blocked",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "#16a34a",
  medium: "#f59e0b",
  high: "#ea580c",
  critical: "#dc2626",
};

const CATEGORY_LABELS: Record<string, string> = {
  order_issue: "Order Issue",
  tier_question: "Tier / Discount Question",
  promo_code: "Promo Code Not Working",
  document_upload: "Document Upload Issue",
  account_access: "Account Access",
  billing: "Billing / Invoice",
  shipping: "Shipping Question",
  general: "General Inquiry",
  other: "Other",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { subject, message, urgency, category } = body as {
    subject: string;
    message: string;
    urgency: string;
    category: string;
  };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const MAX_SUBJECT = 200;
  const MAX_MESSAGE = 5000;
  if (subject.length > MAX_SUBJECT || message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Subject max ${MAX_SUBJECT} characters, message max ${MAX_MESSAGE} characters` },
      { status: 400 }
    );
  }

  if (!["low", "medium", "high", "critical"].includes(urgency)) {
    return NextResponse.json({ error: "Invalid urgency" }, { status: 400 });
  }

  const account = user.wholesaleAccount;
  const tierWindowDays = await loadTierWindowDays();
  const tierWindowLabel = formatTierWindowLabel(tierWindowDays);
  const urgencyLabel = URGENCY_LABELS[urgency] || urgency;
  const urgencyColor = URGENCY_COLORS[urgency] || "#555";
  const categoryLabel = (category && CATEGORY_LABELS[category]) ? CATEGORY_LABELS[category] : (category || "General Inquiry");
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const subjectForEmail = subject.length > 80 ? subject.slice(0, 77) + "..." : subject;

  const { RESEND_API_KEY, EMAIL_FROM } = env();
  const resend = new Resend(RESEND_API_KEY);

  const supportTo = "wholesale@theperfectpart.net";
  const supportPayload = {
    from: EMAIL_FROM,
    to: supportTo,
    replyTo: user.email,
    subject: `[Wholesale Support${urgency === "critical" ? " — CRITICAL" : urgency === "high" ? " — URGENT" : ""}] ${subjectForEmail}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 0;">
        <!-- Header -->
        <div style="background: #2d2d2d; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0 0 4px 0; font-size: 18px;">Wholesale Support Request</h2>
          <p style="margin: 0; font-size: 13px; opacity: 0.8;">From the Wholesale Portal</p>
        </div>

        <!-- Urgency Banner -->
        <div style="background: ${urgencyColor}; color: #fff; padding: 10px 24px; font-size: 13px; font-weight: 600;">
          Urgency: ${urgencyLabel}
        </div>

        <!-- Body -->
        <div style="border: 1px solid #e5e0dd; border-top: 0; border-radius: 0 0 8px 8px; padding: 24px;">
          <!-- Account Info -->
          <table style="width: 100%; font-size: 13px; color: #555; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333; width: 140px;">Email</td>
              <td style="padding: 6px 0; color: #B8282E;">${escapeHtml(user.email)}</td>
            </tr>
            ${account ? `
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">Company</td>
              <td style="padding: 6px 0;">${escapeHtml(account.companyName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">Status</td>
              <td style="padding: 6px 0;">${escapeHtml(account.status)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">Tier</td>
              <td style="padding: 6px 0;">${escapeHtml(account.lastTier)} (${account.lastCount7d} orders / ${escapeHtml(tierWindowLabel)})</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">BC Customer ID</td>
              <td style="padding: 6px 0;">${account.customerId ? `#${account.customerId}` : "Not linked"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">Alias</td>
              <td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${escapeHtml(account.alias)}</td>
            </tr>
            ${account.phone ? `
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">Phone</td>
              <td style="padding: 6px 0;">${escapeHtml(account.phone)}</td>
            </tr>` : ""}
            ` : `
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">Account</td>
              <td style="padding: 6px 0; color: #888;">No wholesale account (retail user)</td>
            </tr>
            `}
            <tr>
              <td style="padding: 6px 12px 6px 0; font-weight: 600; color: #333;">Category</td>
              <td style="padding: 6px 0;">${escapeHtml(categoryLabel)}</td>
            </tr>
          </table>

          <!-- Divider -->
          <hr style="border: none; border-top: 1px solid #e5e0dd; margin: 16px 0;" />

          <!-- Subject -->
          <p style="font-size: 15px; font-weight: 600; color: #333; margin: 0 0 12px 0;">${safeSubject}</p>

          <!-- Message -->
          <div style="background: #f9f7f6; border-radius: 6px; padding: 16px; font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</div>

          <!-- Footer -->
          <p style="font-size: 11px; color: #999; margin: 20px 0 0 0;">
            Reply directly to this email to respond to the customer at ${user.email}.
          </p>
        </div>
      </div>
    `,
  };

  const [supportResult] = await Promise.all([
    resend.emails.send(supportPayload),
    sendSupportConfirmation(user.email, subject),
  ]);
  const { data, error } = supportResult;

  if (error) {
    console.error("Failed to send support email:", error);
    const errDetail = typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);
    console.error("Resend error detail:", errDetail);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  if (data?.id) {
    console.log(`Support email sent to ${supportTo}, Resend id: ${data.id}`);
  }

  return NextResponse.json({ success: true });
}
