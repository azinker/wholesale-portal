import { bc } from "@/lib/bigcommerce/client";

export const WHOLESALE_GROUP_NAME = "Wholesale";

export type WholesalePromotionCustomerEligibility = {
  group_ids: number[];
};

/** Resolve the BigCommerce customer group used for approved wholesale partners. */
export async function getWholesaleCustomerGroupId(): Promise<number | null> {
  try {
    const group = await bc().getCustomerGroupByName(WHOLESALE_GROUP_NAME);
    return group?.id ?? null;
  } catch (err) {
    console.warn("Could not resolve Wholesale customer group:", err);
    return null;
  }
}

/** Only logged-in Wholesale group members may redeem these coupon promotions. */
export function wholesalePromotionCustomerEligibility(
  wholesaleGroupId: number
): WholesalePromotionCustomerEligibility {
  return { group_ids: [wholesaleGroupId] };
}

export function buildWholesaleCouponPromotionBody(params: {
  code: string;
  discountPercent: number;
  wholesaleGroupId: number;
}): Record<string, unknown> {
  return {
    name: `Wholesale ${params.code}`,
    redemption_type: "COUPON",
    status: "ENABLED",
    can_be_used_with_other_promotions: false,
    customer: wholesalePromotionCustomerEligibility(params.wholesaleGroupId),
    rules: [
      {
        action: {
          cart_value: {
            discount: {
              percentage_amount: params.discountPercent.toString(),
            },
          },
        },
        apply_once: true,
        stop: false,
      },
      {
        action: {
          shipping: {
            free_shipping: true,
            zone_ids: "*",
          },
        },
        apply_once: true,
        stop: false,
      },
    ],
    notifications: [],
    currency_code: "USD",
  };
}

/** Keep legacy promotions aligned with Wholesale-only eligibility. */
export async function syncWholesalePromotionEligibility(
  promoId: number,
  wholesaleGroupId: number
): Promise<void> {
  await bc().updatePromotion(promoId, {
    customer: wholesalePromotionCustomerEligibility(wholesaleGroupId),
  });
}
