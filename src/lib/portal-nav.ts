export type PortalNavIcon =
  | "dashboard"
  | "hot-sellers"
  | "orders"
  | "tracking"
  | "insights"
  | "calculator"
  | "documents"
  | "performance"
  | "share"
  | "profile"
  | "team"
  | "support"
  | "terms"
  | "apply";

export interface PortalNavDefinition {
  href: string;
  label: string;
  icon: PortalNavIcon;
  exact?: boolean;
}

const RESELLER_NAV: PortalNavDefinition[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/hot-sellers", label: "Hot Sellers", icon: "hot-sellers" },
  { href: "/orders", label: "Orders", icon: "orders" },
  { href: "/tracking", label: "Tracking", icon: "tracking" },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/margin-calculator", label: "Margin Calculator", icon: "calculator" },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/team", label: "Team", icon: "team" },
  { href: "/support", label: "Support", icon: "support" },
  { href: "/terms", label: "Terms of Service", icon: "terms" },
];

const PUBLISHER_NAV: PortalNavDefinition[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/performance", label: "Performance", icon: "performance" },
  { href: "/share-kit", label: "Share Kit", icon: "share" },
  { href: "/hot-sellers", label: "Products to Promote", icon: "hot-sellers" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/support", label: "Support", icon: "support" },
  { href: "/terms", label: "Publisher Terms", icon: "terms" },
];

export function getPortalNav(
  partnerType: string | null | undefined,
  status: string,
): PortalNavDefinition[] {
  const publisher = partnerType === "AFFILIATE_PUBLISHER";
  const items = (publisher ? PUBLISHER_NAV : RESELLER_NAV).map((item) => ({ ...item }));

  if (status === "RETAIL" || status === "DENIED") {
    items.push({
      href: publisher ? "/apply/publisher" : status === "DENIED" ? "/?reapply=1" : "/apply/reseller",
      label: status === "DENIED" ? `Reapply as ${publisher ? "Publisher" : "Reseller"}` : `Apply as ${publisher ? "Publisher" : "Reseller"}`,
      icon: "apply",
    });
  }

  return items;
}
