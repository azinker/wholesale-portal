import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/env";
import { bc } from "@/lib/bigcommerce/client";

const WEBHOOK_SCOPES = [
  "store/customer/created",
  "store/customer/updated",
  "store/order/created",
  "store/order/statusUpdated",
];

/** List current webhooks (admin only) */
export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const hooks = await bc().getWebhooks();
    return NextResponse.json(hooks);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Register webhooks for this app (admin only) */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const destination = body.destination as string; // e.g. https://ngrok-url.ngrok.io/api/webhooks/bigcommerce

    if (!destination) {
      return NextResponse.json(
        { error: "destination URL required" },
        { status: 400 }
      );
    }

    const results = [];
    for (const scope of WEBHOOK_SCOPES) {
      try {
        const hook = await bc().createWebhook({
          scope,
          destination,
          is_active: true,
        });
        results.push({ scope, status: "created", hook });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({ scope, status: "failed", error: msg });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
