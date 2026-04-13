import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
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
} from "lucide-react";

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

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, exact: true },
    { href: "/hot-sellers", label: "Hot Sellers", icon: <Flame size={18} /> },
    { href: "/orders", label: "Orders", icon: <ShoppingCart size={18} /> },
    { href: "/tracking", label: "Tracking", icon: <Truck size={18} /> },
    { href: "/insights", label: "Insights", icon: <BarChart3 size={18} /> },
    { href: "/margin-calculator", label: "Margin Calculator", icon: <Calculator size={18} /> },
    { href: "/documents", label: "Documents", icon: <Upload size={18} /> },
    { href: "/profile", label: "Profile", icon: <UserCircle size={18} /> },
    { href: "/team", label: "Team", icon: <Users size={18} /> },
    { href: "/support", label: "Support", icon: <Headphones size={18} /> },
    { href: "/terms", label: "Terms of Service", icon: <ScrollText size={18} /> },
  ];

  if (status === "RETAIL") {
    navItems.push({
      href: "/",
      label: "Apply for Wholesale",
      icon: <FileText size={18} />,
    });
  }

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
        subtitle="Wholesale Portal"
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
