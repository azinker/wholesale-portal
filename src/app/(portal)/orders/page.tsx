import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { bc, type BCOrder } from "@/lib/bigcommerce/client";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, AlertCircle, AlertTriangle } from "lucide-react";
import { OrdersTable } from "./orders-table";

const ORDERS_PER_PAGE = 250;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/");

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const customerId = user.linkedCustomerId;
  let orders: BCOrder[] = [];
  let fetchError = "";

  if (customerId) {
    try {
      orders = await bc().getOrders({
        customer_id: customerId,
        limit: ORDERS_PER_PAGE,
        page: currentPage,
        sort: "date_created",
        direction: "desc",
      });
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Failed to fetch orders";
    }
  }

  // If we got a full page of results, there might be more
  const hasMore = orders.length >= ORDERS_PER_PAGE;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-primary" />
          Orders
        </h1>
        <p className="text-muted-foreground mt-1">
          View your recent orders from The Perfect Part.
        </p>
      </div>

      {!customerId && (
        <Card className="border-warning/30 bg-warning-light/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              Your account is not yet linked. Orders will appear once connected.
            </p>
          </CardContent>
        </Card>
      )}

      {fetchError && (
        <Card className="border-danger/30 bg-danger-light/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
            <p className="text-sm text-danger">{fetchError}</p>
          </CardContent>
        </Card>
      )}

      {customerId && orders.length === 0 && !fetchError && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {currentPage > 1 ? "No more orders found." : "No orders found."}
            </p>
          </CardContent>
        </Card>
      )}

      {orders.length > 0 && (
        <OrdersTable
          orders={orders.map((o) => ({
            id: o.id,
            date_created: o.date_created,
            status: o.status,
            items_total: o.items_total,
            total_inc_tax: o.total_inc_tax,
          }))}
          currentPage={currentPage}
          hasMore={hasMore}
        />
      )}
    </div>
  );
}
