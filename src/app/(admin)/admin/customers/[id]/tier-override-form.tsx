"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Lock, Unlock } from "lucide-react";

export default function TierOverrideForm({
  accountId,
  currentTier,
  isLocked,
  tierOptions,
}: {
  accountId: string;
  currentTier: string;
  isLocked: boolean;
  tierOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [tier, setTier] = useState(currentTier);
  const [locked, setLocked] = useState(isLocked);
  const [saving, setSaving] = useState(false);

  const hasChanges = tier !== currentTier || locked !== isLocked;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${accountId}/tier-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, locked }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update tier");
      }

      const data = await res.json();
      toast.success("Tier updated", {
        description: `${data.previousTier} → ${data.newTier}${data.locked ? " (locked)" : ""}`,
      });
      router.refresh();
    } catch (err) {
      toast.error("Failed to update tier", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <Label>Tier Level</Label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {tierOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-3 pb-0.5">
          <div className="flex items-center gap-2">
            <Switch
              id="locked"
              checked={locked}
              onCheckedChange={setLocked}
            />
            <Label htmlFor="locked" className="flex items-center gap-1.5 cursor-pointer">
              {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              {locked ? "Tier Locked" : "Auto-calculate"}
            </Label>
          </div>
        </div>
      </div>

      {locked && (
        <p className="text-xs text-warning bg-warning-light rounded-lg px-3 py-2">
          When locked, this customer&apos;s tier will not change during automatic recalculations.
          Only manual admin overrides will apply.
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={saving || !hasChanges}
        size="sm"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Override"
        )}
      </Button>
    </div>
  );
}
