/** How many quantity writes one store gets per cron run. Shopify's steady pace is about 2 per second. */
export const INVENTORY_WRITES_PER_STORE = 120;

/** Stores are separate Shopify limits, so a few can be updated at the same time. */
export const INVENTORY_STORES_AT_ONCE = 4;

export type WarehouseStock = {
  visible: boolean;
  level: number;
  variants: Map<number, number>;
};

/** The quantity we are allowed to show: the full warehouse count, or 0 when the product is hidden or gone. */
export function warehouseOnHand(product: WarehouseStock | undefined, variantId: number): number {
  if (!product?.visible) return 0;
  if (variantId && product.variants.has(variantId)) {
    return Math.max(0, product.variants.get(variantId) || 0);
  }
  return Math.max(0, product.level || 0);
}
