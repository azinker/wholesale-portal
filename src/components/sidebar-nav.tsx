"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, LogOut } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "./notification-bell";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface SidebarNavProps {
  items: NavItem[];
  userEmail: string;
  companyName?: string | null;
  subtitle: string;
  badge?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline" };
  avatarUrl?: string | null;
  envBadge?: React.ReactNode;
  notificationEndpoint?: string; // e.g. "/api/portal/notifications" or "/api/admin/notifications"
  children?: React.ReactNode;
}

/** Get initials from a company name (first letter of first two words) */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function SidebarNav({
  items,
  userEmail,
  companyName,
  subtitle,
  badge,
  avatarUrl,
  envBadge,
  notificationEndpoint,
}: SidebarNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const fallbackText = companyName ? getInitials(companyName) : userEmail.slice(0, 2).toUpperCase();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo + Title */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <Link href="/" className="block p-1">
            <Image
              src="/logo.png"
              alt="The Perfect Part"
              width={150}
              height={38}
              className="object-contain"
              priority
            />
          </Link>
          {notificationEndpoint && (
            <NotificationBell endpoint={notificationEndpoint} variant="sidebar" />
          )}
        </div>
        <p className="text-xs text-sidebar-muted-foreground mt-2 font-medium tracking-wide uppercase">
          {subtitle}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {envBadge}
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-sidebar-border flex-shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={companyName || userEmail} />}
            <AvatarFallback className="bg-sidebar-muted text-sidebar-foreground text-xs font-bold">
              {fallbackText}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {companyName && (
              <p className="text-xs text-sidebar-foreground truncate font-semibold leading-tight">
                {companyName}
              </p>
            )}
            <p className={cn(
              "text-sidebar-muted-foreground truncate",
              companyName ? "text-[10px] leading-tight mt-0.5" : "text-xs font-medium"
            )}>
              {userEmail}
            </p>
            {badge && (
              <Badge
                variant={badge.variant || "default"}
                className="mt-0.5 text-[10px] h-4 px-1.5"
              >
                {badge.label}
              </Badge>
            )}
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors w-full px-1 py-1"
          >
            <LogOut size={14} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col flex-shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile header + sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-4 py-3 flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-muted -ml-1">
              <Menu size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <SheetTitle className="sr-only">{subtitle} Navigation</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <Image src="/logo.png" alt="The Perfect Part" width={110} height={28} className="object-contain" />
        <div className="ml-auto">
          {notificationEndpoint && (
            <NotificationBell endpoint={notificationEndpoint} variant="sidebar" />
          )}
        </div>
      </div>
    </>
  );
}
