import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { bc } from "@/lib/bigcommerce/client";

/** Test BigCommerce API connection (admin only) */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = await bc().getStoreInfo();
    return NextResponse.json({
      success: true,
      store: {
        name: store.name,
        domain: store.domain,
        plan: store.plan_name,
      },
      target: process.env.TARGET_STORE || "dev",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
