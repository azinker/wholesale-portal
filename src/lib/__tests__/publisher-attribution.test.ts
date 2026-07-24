import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMany,
  attributionCount,
  findAttribution,
  deleteAttribution,
  findAccount,
  updateAccount,
  findPromotions,
  findPromotion,
  createPromotionRecord,
  updatePromotionRecord,
  findSettings,
  createAudit,
  updateBcPromotion,
  createBcPromotion,
  createCouponCode,
  getOrderCouponsStrict,
  sendTierChanged,
  transaction,
  executeRaw,
} = vi.hoisted(() => ({
  createMany: vi.fn(),
  attributionCount: vi.fn(),
  findAttribution: vi.fn(),
  deleteAttribution: vi.fn(),
  findAccount: vi.fn(),
  updateAccount: vi.fn(),
  findPromotions: vi.fn(),
  findPromotion: vi.fn(),
  createPromotionRecord: vi.fn(),
  updatePromotionRecord: vi.fn(),
  findSettings: vi.fn(),
  createAudit: vi.fn(),
  updateBcPromotion: vi.fn(),
  createBcPromotion: vi.fn(),
  createCouponCode: vi.fn(),
  getOrderCouponsStrict: vi.fn(),
  sendTierChanged: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: transaction,
    publisherOrderAttribution: {
      createMany,
      count: attributionCount,
      findUnique: findAttribution,
      delete: deleteAttribution,
    },
    wholesaleAccount: { findUnique: findAccount, update: updateAccount },
    promotionRecord: {
      findMany: findPromotions,
      findFirst: findPromotion,
      create: createPromotionRecord,
      update: updatePromotionRecord,
    },
    globalSettings: { findUnique: findSettings },
    auditLog: { create: createAudit },
  },
}));
vi.mock("@/lib/bigcommerce/client", () => ({
  bc: () => ({
    updatePromotion: updateBcPromotion,
    createPromotion: createBcPromotion,
    createCouponCode,
    getOrderCouponsStrict,
  }),
}));
vi.mock("@/lib/email", () => ({
  sendPublisherTierChangedEmail: sendTierChanged,
}));

import {
  attributePublisherOrder,
  recordPublisherAttribution,
  recalcPublisherTier,
} from "@/lib/publisher-tier-engine";

describe("publisher attribution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    executeRaw.mockResolvedValue(1);
    transaction.mockImplementation(
      (callback: (tx: { $executeRaw: typeof executeRaw }) => unknown) =>
        callback({ $executeRaw: executeRaw })
    );
  });

  it("uses the order ID unique constraint to dedupe webhook retries", async () => {
    createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const data = {
      accountId: "account-1",
      orderId: 123,
      couponCode: "PUB-ACME-P15-ABC123",
      orderDate: new Date("2026-07-24T12:00:00Z"),
      subtotal: null,
    };

    await expect(recordPublisherAttribution(data)).resolves.toBe(true);
    await expect(recordPublisherAttribution(data)).resolves.toBe(false);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("removes attribution when an order becomes non-qualifying", async () => {
    findAttribution.mockResolvedValue({ accountId: "account-1" });
    deleteAttribution.mockResolvedValue({});

    const result = await attributePublisherOrder({
      id: 123,
      customer_id: 0,
      status: "Cancelled",
      status_id: 5,
      subtotal_ex_tax: "100",
      subtotal_inc_tax: "106",
      total_ex_tax: "100",
      total_inc_tax: "106",
      date_created: "2026-07-24T12:00:00Z",
      payment_status: "refunded",
      currency_code: "USD",
      items_total: 1,
      billing_address: { country: "United States", country_iso2: "US" },
    });

    expect(result).toEqual({ attributed: false, accountId: "account-1" });
    expect(deleteAttribution).toHaveBeenCalledWith({ where: { orderId: 123 } });
    expect(getOrderCouponsStrict).not.toHaveBeenCalled();
  });

  it("rotates the code and sends email when a tier changes", async () => {
    findSettings.mockResolvedValue(null);
    findAccount.mockResolvedValue({
      id: "account-1",
      status: "APPROVED",
      partnerType: "AFFILIATE_PUBLISHER",
      lastTier: "P15",
      pausedUpgrades: false,
      alias: "ACME",
      email: "publisher@example.com",
      companyName: "Acme Media",
    });
    attributionCount.mockResolvedValue(50);
    updateAccount.mockResolvedValue({});
    findPromotions.mockResolvedValue([
      { id: "old", tier: "P15", code: "OLD-CODE", promoId: 10 },
    ]);
    findPromotion.mockResolvedValue(null);
    createPromotionRecord.mockResolvedValue({ id: "new" });
    updatePromotionRecord.mockResolvedValue({});
    updateBcPromotion.mockResolvedValue({});
    createBcPromotion.mockResolvedValue({ data: { id: 20 } });
    createCouponCode.mockResolvedValue({});
    createAudit.mockResolvedValue({});
    sendTierChanged.mockResolvedValue(undefined);

    const result = await recalcPublisherTier("account-1");

    expect(result).toMatchObject({ previousTier: "P15", newTier: "P20", changed: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(updateBcPromotion).toHaveBeenCalledWith(10, { status: "DISABLED" });
    expect(createCouponCode).toHaveBeenCalledWith(
      20,
      expect.stringMatching(/^PUB-ACME-P20-[A-Z0-9]{6}$/)
    );
    expect(sendTierChanged).toHaveBeenCalledWith(
      "publisher@example.com",
      "Acme Media",
      "P15",
      "P20",
      50,
      expect.stringMatching(/^PUB-ACME-P20-[A-Z0-9]{6}$/),
      20
    );
  });

  it("does not publish a new tier when the old public promo cannot be disabled", async () => {
    findSettings.mockResolvedValue(null);
    findAccount.mockResolvedValue({
      id: "account-1",
      status: "APPROVED",
      partnerType: "AFFILIATE_PUBLISHER",
      lastTier: "P15",
      pausedUpgrades: false,
      alias: "ACME",
      email: "publisher@example.com",
      companyName: "Acme Media",
    });
    attributionCount.mockResolvedValue(50);
    findPromotions.mockResolvedValue([
      { id: "old", tier: "P15", code: "OLD-CODE", promoId: 10 },
    ]);
    updateBcPromotion.mockRejectedValue(new Error("BigCommerce unavailable"));

    await expect(recalcPublisherTier("account-1")).rejects.toThrow(
      "BigCommerce unavailable"
    );
    expect(updateAccount).not.toHaveBeenCalled();
    expect(createBcPromotion).not.toHaveBeenCalled();
    expect(sendTierChanged).not.toHaveBeenCalled();
  });

  it("reuses a newly rotated code when retrying required email delivery", async () => {
    findSettings.mockResolvedValue(null);
    findAccount.mockResolvedValue({
      id: "account-1",
      status: "APPROVED",
      partnerType: "AFFILIATE_PUBLISHER",
      lastTier: "P15",
      pausedUpgrades: false,
      alias: "ACME",
      email: "publisher@example.com",
      companyName: "Acme Media",
    });
    attributionCount.mockResolvedValue(50);
    findPromotions.mockResolvedValue([
      {
        id: "pending",
        tier: "P20",
        code: "PUB-ACME-P20-PENDING",
        promoId: 20,
      },
    ]);
    sendTierChanged.mockResolvedValue(undefined);
    updateAccount.mockResolvedValue({});
    createAudit.mockResolvedValue({});

    await recalcPublisherTier("account-1");

    expect(updateBcPromotion).not.toHaveBeenCalled();
    expect(createBcPromotion).not.toHaveBeenCalled();
    expect(sendTierChanged).toHaveBeenCalledWith(
      "publisher@example.com",
      "Acme Media",
      "P15",
      "P20",
      50,
      "PUB-ACME-P20-PENDING",
      20
    );
    expect(updateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastTier: "P20" }),
      })
    );
  });
});
