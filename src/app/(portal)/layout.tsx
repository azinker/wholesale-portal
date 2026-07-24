import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { getPortalNav, type PortalNavIcon } from "@/lib/portal-nav";
import {
  LayoutDashboard,
  ShoppingCart,
  Upload,
  FileText,
  UserCircle,
  BarChart3,
  Headphones,
  Flame,
  Truck,
  Calculator,
  Users,
  ScrollText,
  Share2,
} from "lucide-react";

const NAV_ICONS: Record<PortalNavIcon, React.ReactNode> = {
  dashboard: <LayoutDashboard size={18} />,
  "hot-sellers": <Flame size={18} />,
  orders: <ShoppingCart size={18} />,
  tracking: <Truck size={18} />,
  insights: <BarChart3 size={18} />,
  calculator: <Calculator size={18} />,
  documents: <Upload size={18} />,
  performance: <BarChart3 size={18} />,
  share: <Share2 size={18} />,
  profile: <UserCircle size={18} />,
  team: <Users size={18} />,
  support: <Headphones size={18} />,
  terms: <ScrollText size={18} />,
  apply: <FileText size={18} />,
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/");

  // Check if admin is impersonating this user
  const cookieStore = await cookies();
  const isImpersonating = !!cookieStore.get("wsp_admin_session")?.value;

  const status = user.wholesaleAccount?.status || "RETAIL";
  const partnerType = user.wholesaleAccount?.partnerType ?? "DROPSHIPPER";
  const navItems: NavItem[] = getPortalNav(partnerType, status).map((item) => ({
    href: item.href,
    label: item.label,
    icon: NAV_ICONS[item.icon],
    exact: item.exact,
  }));

  const badgeVariant =
    status === "APPROVED"
      ? "default" as const
      : status === "PENDING"
        ? "secondary" as const
        : status === "DENIED"
          ? "destructive" as const
          : "outline" as const;

  return (
    <div className="flex min-h-screen bg-background">
      {isImpersonating && <ImpersonationBanner targetEmail={user.email} />}
      <SidebarNav
        items={navItems}
        userEmail={user.email}
        companyName={user.wholesaleAccount?.companyName ?? null}
        subtitle={partnerType === "AFFILIATE_PUBLISHER" ? "Publisher Portal" : "Wholesale Portal"}
        badge={{ label: status, variant: badgeVariant }}
        avatarUrl={user.avatarUrl ?? null}
        notificationEndpoint="/api/portal/notifications"
      />
      <main className="flex-1 p-6 md:p-8 overflow-auto md:pt-8 pt-20">
        {children}
      </main>
    </div>
  );
}
