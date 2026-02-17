import { TeamRole } from "@prisma/client";

// Permission definitions for each role
const PERMISSIONS: Record<TeamRole, Set<string>> = {
  OWNER: new Set([
    "view_dashboard",
    "view_orders",
    "place_orders",
    "view_products",
    "view_tracking",
    "view_insights",
    "view_documents",
    "upload_documents",
    "edit_profile",
    "edit_business_info",
    "manage_team",
    "view_announcements",
    "contact_support",
    "view_margin_calculator",
  ]),
  ADMIN: new Set([
    "view_dashboard",
    "view_orders",
    "place_orders",
    "view_products",
    "view_tracking",
    "view_insights",
    "view_documents",
    "upload_documents",
    "edit_profile",
    "edit_business_info",
    "manage_team",
    "view_announcements",
    "contact_support",
    "view_margin_calculator",
  ]),
  PURCHASER: new Set([
    "view_dashboard",
    "view_orders",
    "place_orders",
    "view_products",
    "view_tracking",
    "view_announcements",
    "contact_support",
    "view_margin_calculator",
  ]),
  VIEWER: new Set([
    "view_dashboard",
    "view_orders",
    "view_products",
    "view_tracking",
    "view_insights",
    "view_announcements",
    "view_margin_calculator",
  ]),
};

export function hasPermission(role: TeamRole, permission: string): boolean {
  return PERMISSIONS[role]?.has(permission) ?? false;
}

export function getRoleLabel(role: TeamRole): string {
  switch (role) {
    case "OWNER": return "Owner";
    case "ADMIN": return "Admin";
    case "PURCHASER": return "Purchaser";
    case "VIEWER": return "Viewer";
  }
}

export function getRoleDescription(role: TeamRole): string {
  switch (role) {
    case "OWNER": return "Full access. Can manage team, edit business info, and place orders.";
    case "ADMIN": return "Same as owner, except cannot remove the owner.";
    case "PURCHASER": return "Can view products, place orders, and view tracking. Cannot edit business info or manage team.";
    case "VIEWER": return "Read-only access to dashboard, orders, insights, and products.";
  }
}
