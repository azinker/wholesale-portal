"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, ArrowRight, TrendingUp, CheckCircle, AlertTriangle, XCircle, Sparkles, Users, FileEdit, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  variant: "info" | "success" | "warning" | "default" | "destructive";
  timestamp?: string;
  href?: string;
  count?: number;
}

interface NotificationBellProps {
  endpoint: string; // e.g. "/api/portal/notifications" or "/api/admin/notifications"
  variant?: "sidebar" | "header"; // styling context
}

const VARIANT_STYLES: Record<string, string> = {
  info: "bg-info-light text-info border-info/20",
  success: "bg-success-light text-success border-success/20",
  warning: "bg-warning-light text-warning border-warning/20",
  default: "bg-muted text-muted-foreground border-border",
  destructive: "bg-danger-light text-danger border-danger/20",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  tier_progress: <TrendingUp className="h-4 w-4" />,
  tier_achieved: <Sparkles className="h-4 w-4" />,
  encouragement: <Sparkles className="h-4 w-4" />,
  info_change_pending: <FileEdit className="h-4 w-4" />,
  info_change_approved: <CheckCircle className="h-4 w-4" />,
  info_change_denied: <XCircle className="h-4 w-4" />,
  pending_applicant: <Users className="h-4 w-4" />,
  pending_info_change: <FileEdit className="h-4 w-4" />,
  open_risk_flag: <ShieldAlert className="h-4 w-4" />,
  info: <AlertTriangle className="h-4 w-4" />,
};

export function NotificationBell({ endpoint, variant = "sidebar" }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotalCount(data.totalCount ?? data.notifications?.length ?? 0);
    } catch {
      // Silently fail
    }
  }, [endpoint]);

  useEffect(() => {
    fetchNotifications();
    // Refresh every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const isSidebar = variant === "sidebar";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            "relative flex items-center justify-center rounded-lg transition-colors",
            isSidebar
              ? "h-9 w-9 text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted"
              : "h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[380px] sm:w-[420px]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-xs ml-2">
                {totalCount}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              You&apos;re all caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded-lg border p-3.5 transition-colors",
                  VARIANT_STYLES[n.variant] || VARIANT_STYLES.default
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] || <Bell className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{n.title}</p>
                    <p className="text-xs mt-1 opacity-90 leading-relaxed">{n.message}</p>
                    {n.timestamp && (
                      <p className="text-[10px] mt-1.5 opacity-60">
                        {new Date(n.timestamp).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {n.href && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-7 w-7"
                      asChild
                      onClick={() => setOpen(false)}
                    >
                      <Link href={n.href}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
