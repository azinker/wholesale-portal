"use client";

import { OnboardingChecklist } from "@/components/onboarding-checklist";

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
      label: "Place your first order",
      href: "/orders",
      completed: hasOrders,
    },
  ];

  const handleDismiss = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
      });
    } catch {
      // Non-critical
    }
  };

  return <OnboardingChecklist steps={steps} onDismiss={handleDismiss} />;
}
