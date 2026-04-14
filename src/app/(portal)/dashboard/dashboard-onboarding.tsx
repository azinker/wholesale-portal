"use client";

import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { toast } from "sonner";

interface DashboardOnboardingProps {
  profileComplete: boolean;
  hasResaleCert: boolean;
  browsedHotSellers: boolean;
  hasOrders: boolean;
}

export function DashboardOnboarding({
  profileComplete,
  hasResaleCert,
  browsedHotSellers,
  hasOrders,
}: DashboardOnboardingProps) {
  const steps = [
    {
      id: "profile",
      label: "Complete your profile",
      href: "/profile",
      completed: profileComplete,
    },
    {
      id: "checkout_email",
      label: "Sign in to theperfectpart.net with your registered email",
      href: "https://theperfectpart.net/login.php",
      completed: profileComplete,
    },
    {
      id: "resale_cert",
      label: "Upload a resale certificate",
      href: "/documents",
      completed: hasResaleCert,
    },
    {
      id: "hot_sellers",
      label: "Browse hot sellers",
      href: "/hot-sellers",
      completed: browsedHotSellers,
    },
    {
      id: "first_order",
      label: "Place your first order using your coupon code",
      href: "/orders",
      completed: hasOrders,
    },
  ];

  const handleDismiss = async () => {
    try {
      const res = await fetch("/api/onboarding", { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Could not dismiss checklist. Please try again.");
    }
  };

  return <OnboardingChecklist steps={steps} onDismiss={handleDismiss} />;
}
