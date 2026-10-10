"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";
import { channelGhostBtn } from "../../channel-ui";

export function RefreshOrdersButton() {
  const { pending } = useFormStatus();
  return (
    <button className={channelGhostBtn} type="submit" disabled={pending}>
      <RefreshCw className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Checking…" : "Refresh"}
    </button>
  );
}
