import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { channelVisibility } from "@/lib/shopify-channel/visibility";
import { GuideLessons } from "./guide-lessons";

export default async function GuidesPage() {
  const user = await getUser();
  if (!user) redirect("/");
  const account = user.wholesaleAccount;
  if (account?.partnerType === "AFFILIATE_PUBLISHER" || account?.status !== "APPROVED") {
    redirect("/dashboard");
  }
  const shopify = (await channelVisibility(user.email)).visible;
  return <GuideLessons shopify={shopify} />;
}
