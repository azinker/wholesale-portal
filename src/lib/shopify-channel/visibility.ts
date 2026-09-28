import { cookies } from "next/headers";
import { isAdmin } from "@/lib/env";
import { isShopifyChannelEnabled } from "./settings";

/** The kill switch stays off for wholesalers. An admin, or an impersonated account, can open the screens. */
export async function channelVisibility(email?: string | null): Promise<{
  enabled: boolean;
  preview: boolean;
  visible: boolean;
}> {
  const cookieStore = await cookies();
  const impersonating = Boolean(cookieStore.get("wsp_admin_session")?.value);
  const enabled = await isShopifyChannelEnabled();
  const preview = !enabled && (impersonating || Boolean(email && isAdmin(email)));
  return { enabled, preview, visible: enabled || preview };
}
