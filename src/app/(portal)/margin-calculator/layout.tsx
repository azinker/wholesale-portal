import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function MarginCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (user?.wholesaleAccount?.partnerType === "AFFILIATE_PUBLISHER") {
    redirect("/dashboard");
  }
  return children;
}
