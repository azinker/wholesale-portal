import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/env";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Shield,
  Settings,
  ScrollText,
  AlertTriangle,
  FileEdit,
  Megaphone,
} from "lucide-react";

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/admin/applicants", label: "Applicants", icon: <Users size={18} /> },
  { href: "/admin/customers", label: "Customers", icon: <UserCheck size={18} /> },
  { href: "/admin/info-reviews", label: "Info Reviews", icon: <FileEdit size={18} /> },
  { href: "/admin/announcements", label: "Announcements", icon: <Megaphone size={18} /> },
  { href: "/admin/risk-flags", label: "Risk Flags", icon: <AlertTriangle size={18} /> },
  { href: "/admin/promo-audit", label: "Promo Audit", icon: <Shield size={18} /> },
  { href: "/admin/audit-log", label: "Audit Log", icon: <ScrollText size={18} /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings size={18} /> },
];

function EnvBadge() {
  const store = process.env.TARGET_STORE || "dev";
  const writes = process.env.PRODUCTION_WRITES_ENABLED === "true";

  if (store === "prod" && writes) {
    return (
      <Badge variant="destructive" className="text-[10px] w-full justify-center">
        PROD - LIVE WRITES
      </Badge>
    );
  }
  if (store === "prod") {
    return (
      <Badge variant="outline" className="text-[10px] w-full justify-center border-warning text-warning">
        PROD - WRITES BLOCKED
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] w-full justify-center">
      DEV STORE
    </Badge>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/");
  if (!isAdmin(user.email)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav
        items={navItems}
        userEmail={user.email}
        companyName={user.wholesaleAccount?.companyName ?? null}
        subtitle="Admin Portal"
        badge={{ label: "Admin", variant: "default" }}
        avatarUrl={user.avatarUrl ?? null}
        envBadge={<EnvBadge />}
        notificationEndpoint="/api/admin/notifications"
      />
      <main className="flex-1 p-6 md:p-8 overflow-auto md:pt-8 pt-20">
        {children}
      </main>
    </div>
  );
}
