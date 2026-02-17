"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Info } from "lucide-react";
import { CopyTrackingButton } from "./copy-tracking-button";

interface ShipmentRow {
  id: number;
  orderId: number;
  orderStatus: string;
  orderDate: string;
  trackingNumber: string;
  carrier: string;
  shipDate: string;
  carrierUrl: string | null;
}

type Filter = "all" | "shipped" | "partially_refunded" | "cancelled" | "refunded";
type SortField = "orderId" | "orderDate" | "orderStatus" | "trackingNumber" | "carrier" | "shipDate";
type SortDir = "asc" | "desc";

export function TrackingFilters({ shipments }: { shipments: ShipmentRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sortField, setSortField] = useState<SortField>("orderDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filtered = shipments.filter((s) => {
    if (filter === "all") return true;
    const status = s.orderStatus.toLowerCase();
    if (filter === "shipped") return status.includes("ship") || status.includes("transit") || status.includes("awaiting");
    if (filter === "partially_refunded") return status.includes("partially") && status.includes("refund");
    if (filter === "cancelled") return status.includes("cancel");
    if (filter === "refunded") return status.includes("refund") && !status.includes("partially");
    return true;
  });

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "orderId":
          cmp = a.orderId - b.orderId;
          break;
        case "orderDate":
          cmp = new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
          break;
        case "orderStatus":
          cmp = a.orderStatus.localeCompare(b.orderStatus);
          break;
        case "trackingNumber":
          cmp = (a.trackingNumber || "").localeCompare(b.trackingNumber || "");
          break;
        case "carrier":
          cmp = (a.carrier || "").localeCompare(b.carrier || "");
          break;
        case "shipDate":
          cmp = new Date(a.shipDate).getTime() - new Date(b.shipDate).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const counts = {
    all: shipments.length,
    shipped: shipments.filter((s) => {
      const st = s.orderStatus.toLowerCase();
      return st.includes("ship") || st.includes("transit") || st.includes("awaiting");
    }).length,
    partially_refunded: shipments.filter((s) => {
      const st = s.orderStatus.toLowerCase();
      return st.includes("partially") && st.includes("refund");
    }).length,
    cancelled: shipments.filter((s) => s.orderStatus.toLowerCase().includes("cancel")).length,
    refunded: shipments.filter((s) => {
      const st = s.orderStatus.toLowerCase();
      return st.includes("refund") && !st.includes("partially");
    }).length,
  };

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  }

  function SortHeader({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <th
        className={`px-4 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors select-none ${className}`}
        onClick={() => toggleSort(field)}
      >
        <span className="inline-flex items-center">
          {children}
          <SortIcon field={field} />
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs -- renamed to Shipped / Completed for clarity */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {([
            ["all", "All"],
            ["shipped", "Shipped"],
            ["partially_refunded", "Partially Refunded"],
            ["cancelled", "Cancelled"],
            ["refunded", "Refunded"],
          ] as [Filter, string][]).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
            >
              {label}
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {counts[key]}
              </Badge>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3 flex-shrink-0" />
          Status reflects your BigCommerce order status. Click &quot;Track&quot; to check live delivery status from the carrier.
        </p>
      </div>

      {/* Shipments table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <SortHeader field="orderId" className="text-left">Order #</SortHeader>
                <SortHeader field="orderDate" className="text-left">Date</SortHeader>
                <SortHeader field="orderStatus" className="text-left">Status</SortHeader>
                <SortHeader field="trackingNumber" className="text-left">Tracking #</SortHeader>
                <SortHeader field="carrier" className="text-left">Carrier</SortHeader>
                <SortHeader field="shipDate" className="text-left">Ship Date</SortHeader>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={`${s.orderId}-${s.id}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">#{s.orderId}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.orderDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.orderStatus} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.trackingNumber || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.carrier || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.shipDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {s.trackingNumber && (
                        <CopyTrackingButton trackingNumber={s.trackingNumber} />
                      )}
                      {s.carrierUrl && (
                        <a
                          href={s.carrierUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1"
                        >
                          Track <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No shipments match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  if (lower.includes("ship")) variant = "secondary";
  else if (lower.includes("cancel") || lower.includes("refund")) variant = "destructive";

  return <Badge variant={variant} className="text-[10px]">{status}</Badge>;
}
