"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface CustomerGroupData {
  customerId: number;
  email: string;
  companyName: string;
  firstName: string;
  lastName: string;
  groups: Array<{ id: number; name: string }>;
  taxExemptCategory: string | null;
  allAvailableGroups: Array<{ id: number; name: string }>;
}

export function VerifyCustomerGroupButton({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CustomerGroupData | null>(null);
  const [open, setOpen] = useState(false);

  async function handleVerify() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/verify-customer-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || "Verification failed");
      }
      const result = await res.json();
      setData(result);
      setOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify customer group");
    } finally {
      setLoading(false);
    }
  }

  const wholesaleGroup = data?.groups.find((g) => g.name.toLowerCase().includes("wholesale"));
  const hasWholesaleGroup = !!wholesaleGroup;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={handleVerify} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Verify BC Groups
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>BigCommerce Customer Groups</DialogTitle>
          <DialogDescription>
            Verify customer group assignment for tax exemption and wholesale pricing
          </DialogDescription>
        </DialogHeader>
        {data && (
          <div className="space-y-4">
            {/* Customer Info */}
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm">Customer Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">BC ID:</span>
                  <span className="ml-2 font-mono">#{data.customerId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2">{data.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <span className="ml-2">{data.firstName} {data.lastName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Company:</span>
                  <span className="ml-2">{data.companyName}</span>
                </div>
              </div>
            </div>

            {/* Current Groups */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Current Groups</h3>
              {data.groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No groups assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.groups.map((group) => (
                    <Badge
                      key={group.id}
                      variant={group.name.toLowerCase().includes("wholesale") ? "default" : "outline"}
                      className="text-xs"
                    >
                      {group.name} (ID: {group.id})
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Tax Exempt Category */}
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground">Tax Exempt Category:</span>
                <span className="ml-2 text-sm font-mono">
                  {data.taxExemptCategory || "None"}
                </span>
              </div>
            </div>

            {/* Wholesale Group Status */}
            <div className={`rounded-lg border p-4 ${hasWholesaleGroup ? "bg-success-light/20 border-success" : "bg-danger-light/20 border-danger"}`}>
              <h3 className="font-semibold text-sm mb-2">
                {hasWholesaleGroup ? "✓ Wholesale Group Found" : "⚠️ Wholesale Group Missing"}
              </h3>
              {hasWholesaleGroup ? (
                <p className="text-sm text-muted-foreground">
                  Customer is in the <strong>{wholesaleGroup.name}</strong> group.
                  Tax exemption rules should apply if configured correctly.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-danger">
                    Customer is NOT in a Wholesale group. This will cause tax to be charged.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fix: In BigCommerce → Customers → Edit customer → assign to "Wholesale" group
                  </p>
                </div>
              )}
            </div>

            {/* All Available Groups */}
            <details className="rounded-lg border p-4">
              <summary className="font-semibold text-sm cursor-pointer">
                All Available Groups in BigCommerce ({data.allAvailableGroups.length})
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.allAvailableGroups.map((group) => (
                  <Badge key={group.id} variant="outline" className="text-xs">
                    {group.name} (ID: {group.id})
                  </Badge>
                ))}
              </div>
            </details>

            {/* Troubleshooting */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h3 className="font-semibold text-sm">Tax Troubleshooting</h3>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Customer must be in a "Wholesale" group for tax exemption</li>
                <li>Tax zone "Wholesale No Tax" must apply to the Wholesale group only</li>
                <li>Check Settings → Tax → Tax rates and zones for conflicts</li>
                <li>Verify no other tax rules have higher priority</li>
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
