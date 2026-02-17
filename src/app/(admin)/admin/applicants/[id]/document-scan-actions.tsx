"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DocumentScanActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [bypassing, setBypassing] = useState(false);

  async function handleScan() {
    if (!confirm("Trigger virus scan for this document?")) return;
    setScanning(true);
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/scan`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      toast.success(`Scan complete: ${data.scanStatus}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  }

  async function handleBypass() {
    if (!confirm("⚠️ SECURITY WARNING: Mark this document as CLEAN without scanning?\n\nOnly bypass if you trust the source. This bypasses virus protection.")) return;
    setBypassing(true);
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/bypass-scan`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bypass failed");
      toast.success("Document marked as CLEAN (scan bypassed)");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bypass failed";
      toast.error(msg);
    } finally {
      setBypassing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleScan}
        disabled={scanning || bypassing}
      >
        {scanning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        <span className="ml-1">{scanning ? "Scanning..." : "Scan Now"}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleBypass}
        disabled={scanning || bypassing}
      >
        <ShieldOff className="h-3 w-3" />
        <span className="ml-1">{bypassing ? "Bypassing..." : "Bypass Scan"}</span>
      </Button>
    </div>
  );
}
