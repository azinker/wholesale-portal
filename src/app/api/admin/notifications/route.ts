import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { db } from "@/lib/db";

export interface AdminNotification {
  id: string;
  type: "pending_applicant" | "pending_info_change" | "open_risk_flag" | "info";
  title: string;
  message: string;
  variant: "warning" | "info" | "default" | "destructive";
  href?: string;
  count?: number;
}

/** GET: Compute admin notifications (pending reviews, risk flags, etc.) */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notifications: AdminNotification[] = [];

  // Pending applicants
  const pendingApplicants = await db.wholesaleAccount.count({
    where: { status: "PENDING" },
  });
  if (pendingApplicants > 0) {
    notifications.push({
      id: "pending-applicants",
      type: "pending_applicant",
      title: "Pending Applications",
      message: `${pendingApplicants} wholesale application${pendingApplicants > 1 ? "s" : ""} awaiting review.`,
      variant: "warning",
      href: "/admin/applicants",
      count: pendingApplicants,
    });
  }

  // Pending business info changes
  const pendingChanges = await db.businessInfoChange.count({
    where: { status: "PENDING" },
  });
  if (pendingChanges > 0) {
    notifications.push({
      id: "pending-info-changes",
      type: "pending_info_change",
      title: "Business Info Reviews",
      message: `${pendingChanges} business info change${pendingChanges > 1 ? "s" : ""} need${pendingChanges === 1 ? "s" : ""} review.`,
      variant: "warning",
      href: "/admin/info-reviews",
      count: pendingChanges,
    });
  }

  // Open risk flags
  const openRiskFlags = await db.riskFlag.count({
    where: { status: "OPEN" },
  });
  if (openRiskFlags > 0) {
    notifications.push({
      id: "open-risk-flags",
      type: "open_risk_flag",
      title: "Open Risk Flags",
      message: `${openRiskFlags} risk flag${openRiskFlags > 1 ? "s" : ""} require attention.`,
      variant: "destructive",
      href: "/admin/risk-flags",
      count: openRiskFlags,
    });
  }

  const totalCount = pendingApplicants + pendingChanges + openRiskFlags;

  return NextResponse.json({ notifications, totalCount });
}
