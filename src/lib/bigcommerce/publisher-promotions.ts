import { randomCode, toAlias } from "@/lib/utils";

export const PUBLISHER_PROMO_KIND = "PUBLISHER_AUDIENCE";

export function formatPublisherCouponCode(alias: string, tier: string): string {
  const normalizedTier = /^P(15|20|25)$/.test(tier) ? tier : "P15";
  return `PUB-${toAlias(alias)}-${normalizedTier}-${randomCode()}`;
}

export function buildPublisherCouponPromotionBody(params: {
  code: string;
  discountPercent: number;
}): Record<string, unknown> {
  return {
    name: `Publisher Audience ${params.code}`,
    redemption_type: "COUPON",
    status: "ENABLED",
    can_be_used_with_other_promotions: false,
    customer: {},
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
    ],
    notifications: [],
    currency_code: "USD",
  };
}
