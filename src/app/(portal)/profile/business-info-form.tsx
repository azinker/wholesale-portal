"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2,
  Phone,
  MapPin,
  Globe,
  Pencil,
  X,
  Check,
  Loader2,
  Clock,
} from "lucide-react";

interface BusinessInfo {
  companyName: string;
  legalName: string | null;
  phone: string | null;
  businessAddress: string | null;
  primaryState: string | null;
  website: string | null;
}

interface PendingChange {
  id: string;
  status: string;
  newValues: Record<string, string>;
  createdAt: string;
}

const FIELD_CONFIG = [
  { key: "companyName", label: "Company Name", icon: Building2, required: true },
  { key: "legalName", label: "Legal Name", icon: Building2 },
  { key: "phone", label: "Phone", icon: Phone },
  { key: "businessAddress", label: "Address", icon: MapPin },
  { key: "primaryState", label: "State", icon: MapPin },
  { key: "website", label: "Website", icon: Globe },
] as const;

export default function BusinessInfoForm({
  businessInfo,
  pendingChange,
}: {
  businessInfo: BusinessInfo;
  pendingChange: PendingChange | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    companyName: businessInfo.companyName,
    legalName: businessInfo.legalName || "",
    phone: businessInfo.phone || "",
    businessAddress: businessInfo.businessAddress || "",
    primaryState: businessInfo.primaryState || "",
    website: businessInfo.website || "",
  });

  function handleChange(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function hasChanges() {
    return FIELD_CONFIG.some((f) => {
      const current = (businessInfo[f.key as keyof BusinessInfo] ?? "").toString();
      return current !== formData[f.key];
    });
  }

  function handleCancel() {
    setFormData({
      companyName: businessInfo.companyName,
      legalName: businessInfo.legalName || "",
      phone: businessInfo.phone || "",
      businessAddress: businessInfo.businessAddress || "",
      primaryState: businessInfo.primaryState || "",
      website: businessInfo.website || "",
    });
    setEditing(false);
  }

  async function handleSubmit() {
    if (!formData.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    // Build only changed fields
    const changes: Record<string, string> = {};
    for (const f of FIELD_CONFIG) {
      const current = (businessInfo[f.key as keyof BusinessInfo] ?? "").toString();
      if (current !== formData[f.key]) {
        changes[f.key] = formData[f.key];
      }
    }

    if (Object.keys(changes).length === 0) {
      toast.info("No changes to submit");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/business-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit changes");
      }

      toast.success("Changes submitted for review. You'll be notified once reviewed.");
      setEditing(false);
      // Reload to show updated pending state
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pending change banner */}
      {pendingChange && (
        <div className="rounded-lg border border-warning/30 bg-warning-light/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm font-semibold text-warning">Pending Review</span>
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {new Date(pendingChange.createdAt).toLocaleDateString()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            You have changes awaiting admin review. New changes cannot be submitted until this is resolved.
          </p>
          <div className="space-y-1">
            {Object.entries(pendingChange.newValues).map(([key, value]) => {
              const field = FIELD_CONFIG.find((f) => f.key === key);
              return (
                <p key={key} className="text-xs">
                  <span className="font-medium">{field?.label || key}:</span>{" "}
                  <span className="text-muted-foreground">{value}</span>
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={saving || !hasChanges()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Submit for Review
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={!!pendingChange}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit Information
          </Button>
        )}
      </div>

      <Separator />

      {/* Fields */}
      <div className="space-y-4">
        {FIELD_CONFIG.map((field) => {
          const Icon = field.icon;
          const currentValue = (businessInfo[field.key as keyof BusinessInfo] ?? "").toString();
          const pendingValue = pendingChange?.newValues?.[field.key];

          return (
            <div key={field.key} className="flex items-start gap-3">
              <div className="text-muted-foreground mt-2">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                {editing ? (
                  <Input
                    value={formData[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    className="mt-1 h-9"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium mt-0.5">
                      {currentValue || "—"}
                    </p>
                    {pendingValue && pendingValue !== currentValue && (
                      <Badge variant="outline" className="text-[10px] border-warning text-warning">
                        → {pendingValue}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
