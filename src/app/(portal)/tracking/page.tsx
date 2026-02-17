import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { bc, type BCOrder, type BCShipment } from "@/lib/bigcommerce/client";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Package } from "lucide-react";
import { TrackingFilters } from "./tracking-filters";

interface ShipmentWithOrder extends BCShipment {
  order_id: number;
  order_status: string;
  order_date: string;
}

/**
 * Detect carrier from shipping_method name first, then fall back to tracking number format.
 * USPS regex MUST come before FedEx to avoid false positives.
 */
function detectCarrier(trackingNumber: string, shippingMethod: string): string {
  const method = shippingMethod.toLowerCase();

  // Check shipping method name first (most reliable)
  if (method.includes("usps") || method.includes("postal")) return "USPS";
  if (method.includes("ups") && !method.includes("usps")) return "UPS";
  if (method.includes("fedex") || method.includes("fed ex")) return "FedEx";
  if (method.includes("dhl")) return "DHL";

  // Fall back to tracking number format
  if (!trackingNumber) return shippingMethod || "Unknown";

  // UPS: starts with 1Z
  if (/^1Z/i.test(trackingNumber)) return "UPS";

  // USPS: 20-22 digits starting with 92, 93, 94, 95 (must check BEFORE FedEx)
  if (/^(92|93|94|95)\d{18,22}$/.test(trackingNumber)) return "USPS";
  // USPS: 13-char alphanumeric (e.g. international)
  if (/^[A-Z]{2}\d{9}US$/i.test(trackingNumber)) return "USPS";
  // USPS: 20+ digits (common USPS format)
  if (/^\d{20,22}$/.test(trackingNumber)) return "USPS";

  // FedEx: 12-15 digits only (narrower range to avoid USPS collision)
  if (/^\d{12,15}$/.test(trackingNumber)) return "FedEx";

  // DHL: 10-digit starting with specific patterns
  if (/^\d{10}$/.test(trackingNumber)) return "DHL";

  return shippingMethod || "Unknown";
}

function getCarrierUrl(trackingNumber: string, carrier: string): string | null {
  if (!trackingNumber) return null;

  const c = carrier.toLowerCase();
  if (c.includes("usps") || c.includes("postal"))
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  if (c.includes("ups"))
    return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c.includes("fedex") || c.includes("fed ex"))
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c.includes("dhl"))
    return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;

  return null;
}

export default async function TrackingPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const customerId = user.linkedCustomerId;
  let allShipments: ShipmentWithOrder[] = [];
  let fetchError = "";

  if (customerId) {
    try {
      const orders = await bc().getOrders({
        customer_id: customerId,
        limit: 250,
        page: 1,
        sort: "date_created",
        direction: "desc",
      });

      // Fetch shipments in small batches to avoid BigCommerce 429 rate limits
      const BATCH_SIZE = 8;
      const BATCH_DELAY_MS = 400;
      for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const batch = orders.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (order: BCOrder) => {
            try {
              const shipments = await bc().getOrderShipments(order.id);
              return shipments.map((s: BCShipment) => ({
                ...s,
                order_id: order.id,
                order_status: order.status,
                order_date: order.date_created,
              }));
            } catch {
              return [];
            }
          })
        );
        allShipments = allShipments.concat(batchResults.flat());
        if (i + BATCH_SIZE < orders.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch tracking data";
      fetchError = msg.includes("429")
        ? "Too many requests. Please wait a moment and refresh the page to try again."
        : msg;
    }
  }

  // Pre-process: detect carrier and generate tracking URLs
  const shipmentsWithLinks = allShipments.map((s) => {
    const carrier = detectCarrier(s.tracking_number, s.shipping_method);
    return {
      ...s,
      detectedCarrier: carrier,
      carrierUrl: getCarrierUrl(s.tracking_number, carrier),
    };
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          Order Tracking
        </h1>
        <p className="text-muted-foreground mt-1">
          Track all your shipments in one place. Copy tracking numbers to your clipboard.
        </p>
      </div>

      {!customerId && (
        <Card className="border-warning/30 bg-warning-light/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <Package className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              Your account is not yet linked. Tracking data will appear once connected.
            </p>
          </CardContent>
        </Card>
      )}

      {fetchError && (
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{fetchError}</p>
            {fetchError.includes("429") && (
              <p className="text-sm text-muted-foreground mt-2">
                You can refresh the page now to try again.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {customerId && shipmentsWithLinks.length === 0 && !fetchError && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No shipments found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tracking info will appear once orders are shipped.
            </p>
          </CardContent>
        </Card>
      )}

      {shipmentsWithLinks.length > 0 && (
        <TrackingFilters
          shipments={shipmentsWithLinks.map((s) => ({
            id: s.id,
            orderId: s.order_id,
            orderStatus: s.order_status,
            orderDate: s.order_date,
            trackingNumber: s.tracking_number,
            carrier: s.detectedCarrier,
            shipDate: s.date_created,
            carrierUrl: s.carrierUrl,
          }))}
        />
      )}
    </div>
  );
}
