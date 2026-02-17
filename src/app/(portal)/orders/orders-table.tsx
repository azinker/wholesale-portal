"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ReorderButton } from "./reorder-button";

interface OrderRow {
  id: number;
  date_created: string;
  status: string;
  items_total: number;
  total_inc_tax: string;
}

type SortField = "id" | "date_created" | "status" | "items_total" | "total_inc_tax";
type SortDir = "asc" | "desc";

export function OrdersTable({
  orders,
  currentPage,
  hasMore,
}: {
  orders: OrderRow[];
  currentPage: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortField, setSortField] = useState<SortField>("date_created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/orders?${params.toString()}`);
  }

  const sorted = useMemo(() => {
    const copy = [...orders];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "id":
          cmp = a.id - b.id;
          break;
        case "date_created":
          cmp = new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "items_total":
          cmp = a.items_total - b.items_total;
          break;
        case "total_inc_tax":
          cmp = parseFloat(a.total_inc_tax) - parseFloat(b.total_inc_tax);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [orders, sortField, sortDir]);

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
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <SortHeader field="id" className="text-left">Order #</SortHeader>
                <SortHeader field="date_created" className="text-left">Date</SortHeader>
                <SortHeader field="status" className="text-left">Status</SortHeader>
                <SortHeader field="items_total" className="text-left">Items</SortHeader>
                <SortHeader field="total_inc_tax" className="text-right">Total</SortHeader>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((order) => (
                <tr
                  key={order.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-medium">#{order.id}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(order.date_created).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <OrderBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.items_total} item{order.items_total !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    ${parseFloat(order.total_inc_tax).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReorderButton orderId={order.id} />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No orders found on this page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {currentPage} &middot; Showing {sorted.length} order{sorted.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  if (lower.includes("complete")) variant = "default";
  else if (lower.includes("shipped")) variant = "secondary";
  else if (lower.includes("cancel") || lower.includes("refund")) variant = "destructive";

  return <Badge variant={variant} className="text-[10px]">{status}</Badge>;
}
