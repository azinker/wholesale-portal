# Affiliate Publisher Program — Implementation Spec

**Repo:** https://github.com/azinker/wholesale-portal  
**Stack:** Next.js 15, Prisma/PostgreSQL, BigCommerce API, Vercel deploy from `main`  
**Status:** Planning complete — ready for implementation  
**Last updated:** 2026-07-24  

---

## 1. Executive summary

Split `wholesale.theperfectpart.net` into **two partner programs** sharing one codebase:

| | **Drop shipper / Reseller** (existing) | **Affiliate Publisher** (new) |
|---|---|---|
| `partnerType` | `DROPSHIPPER` | `AFFILIATE_PUBLISHER` |
| Who gets discount | Partner (logged into theperfectpart.net) | Partner's **audience** (guest checkout OK) |
| Partner earns | Margin on resale | **AWIN commission** on referred sales |
| Tier counting | Partner's own BC `customer_id` orders | Orders using publisher's **audience coupon code** |
| BC promotion | Wholesale customer group **required** (already shipped) | **No** Wholesale group; guest-eligible |
| Tax | Tax-exempt (Wholesale group) | **Normal retail tax** on audience orders |
| Shipping | Free shipping on wholesale orders | **Standard retail shipping** |
| Code sharing | **Forbidden** (terms + BC restriction) | **Expected** — codes go on deal sites/blogs |
| Tier floor | Can drop to NONE (no code) | **15% forever** once approved — never lose code |

**Do not** bolt publisher behavior onto the reseller flow. Branch on `partnerType` everywhere.

---

## 2. Confirmed business rules

### 2.1 Publisher tier model (FINAL)

Rolling window: **14 days** (resellers keep **7 days**).

| Tier ID | Audience discount | Min attributed orders (14d) | Notes |
|---------|-------------------|-------------------------------|-------|
| `P15` | **15%** | **0** | **Floor — default on approval; never removed** |
| `P20` | 20% | **50** | Upgrade |
| `P25` | 25% | **125** | Max tier |

**Downgrade behavior:** P25 → P20 → **P15 only**. Never `NONE`. Never below 15%.

**No welcome 20%/72h** for publishers (resellers keep welcome discount).

**On tier change (up OR down):**
1. Disable old BigCommerce promotion
2. Issue new coupon code
3. Email publisher immediately (`sendPublisherTierChangedEmail` / extend `sendCouponChangedEmail`)
4. In-app notification
5. Publisher must update codes on their sites/offers

### 2.2 Reseller tier model (UNCHANGED)

Keep existing `DEFAULT_TIERS` in `src/lib/tier-engine.ts`:
- 7-day window, T10/T15/T20/T25/T30 at 5/25/50/100/200 orders
- Wholesale BC group restriction via `src/lib/bigcommerce/wholesale-promotions.ts` (commit `9704c8f`)

### 2.3 AWIN + discount together

Publishers must promote **both**:
1. **AWIN tracking link** (commission) — merchant profile: `https://ui.awin.com/merchant-profile/121802`
2. **Audience discount code** from portal (tier-based)

Existing S2S proxy: `src/app/api/awin/s2s/route.ts` (fires on BC order confirmation).

Dashboard must explain: link + code together = commission + audience discount.

### 2.4 Tax

- **Reseller:** tax-exempt via Wholesale customer group
- **Publisher audience:** standard retail tax at checkout — **not** in Wholesale group

---

## 3. Codebase map (read these first)

```
src/app/page.tsx                          # Marketing homepage (currently reseller-only)
src/app/apply/page.tsx                    # Application form
src/app/api/apply/route.ts                # Application API
src/app/api/admin/applicants/[id]/approve/route.ts
src/app/(portal)/layout.tsx               # Sidebar nav
src/app/(portal)/dashboard/page.tsx       # Main dashboard
src/lib/tier-engine.ts                    # Reseller tier logic
src/lib/bigcommerce/wholesale-promotions.ts  # Reseller BC promos (Wholesale group)
src/lib/bigcommerce/webhooks.ts           # Order webhooks → tier recalc
src/lib/email.ts                          # All transactional emails
src/lib/risk-detection.ts
prisma/schema.prisma
src/app/api/cron/tier-recalc/route.ts
src/app/api/awin/s2s/route.ts
```

---

## 4. Database schema changes

```prisma
enum PartnerType {
  DROPSHIPPER
  AFFILIATE_PUBLISHER
}

model WholesaleAccount {
  // ADD:
  partnerType       PartnerType @default(DROPSHIPPER) @map("partner_type")
  awinPublisherId   String?     @map("awin_publisher_id")
  promoWebsite      String?     @map("promo_website")
  promoTypes        Json?       @map("promo_types")       // string[]
  audienceReach     String?     @map("audience_reach")
  promoDescription  String?     @map("promo_description")
  lastCount14d      Int         @default(0) @map("last_count_14d")

  // lastTier stores P15 | P20 | P25 for publishers
  // Existing fields unchanged; migration sets partnerType=DROPSHIPPER for all existing rows
}

model PromotionRecord {
  // ADD:
  promoKind String @default("DROPSHIPPER") @map("promo_kind")
  // DROPSHIPPER | PUBLISHER_AUDIENCE
}

model PublisherOrderAttribution {
  id         String   @id @default(cuid())
  accountId  String   @map("account_id")
  orderId    Int      @unique @map("order_id")
  couponCode String   @map("coupon_code")
  orderDate  DateTime @map("order_date")
  subtotal   Decimal? @db.Decimal(10, 2)
  countedAt  DateTime @default(now()) @map("counted_at")

  account WholesaleAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId, orderDate])
  @@map("publisher_order_attributions")
}
```

**GlobalSettings** JSON (extend existing `settings`):
```json
{
  "tiers": [ "... existing dropshipper ..." ],
  "tierWindowDays": 7,
  "publisherTiers": [
    { "id": "P15", "label": "15% Audience", "minOrders": 0,   "discount": 15 },
    { "id": "P20", "label": "20% Audience", "minOrders": 50,  "discount": 20 },
    { "id": "P25", "label": "25% Audience", "minOrders": 125, "discount": 25 }
  ],
  "publisherTierWindowDays": 14
}
```

---

## 5. BigCommerce promotions

### Reseller (existing — do not break)
File: `src/lib/bigcommerce/wholesale-promotions.ts`
```json
"customer": { "group_ids": [<Wholesale group ID>] }
```
+ free shipping rule. Login required effectively via Wholesale group.

### Publisher (new file: `src/lib/bigcommerce/publisher-promotions.ts`)
```json
{
  "redemption_type": "COUPON",
  "status": "ENABLED",
  "can_be_used_with_other_promotions": false,
  "customer": {},
  "rules": [
    {
      "action": {
        "cart_value": {
          "discount": { "percentage_amount": "15" }
        }
      },
      "apply_once": true,
      "stop": false
    }
  ],
  "notifications": [],
  "currency_code": "USD"
}
```
**No** `group_ids`. **No** free shipping rule unless product owner requests later.

Coupon code format suggestion: `PUB-<ALIAS>-P15-<RANDOM6>` (mirror `formatCouponCode` in `src/lib/utils.ts`).

---

## 6. Publisher tier engine

New file: `src/lib/publisher-tier-engine.ts` (or extend tier-engine with clear separation)

**Count source:** NOT `customer_id`. On order webhook:
1. Fetch order coupons from BC (`getOrderCoupons`)
2. Match code to `PromotionRecord` where `promoKind = PUBLISHER_AUDIENCE`
3. Insert `PublisherOrderAttribution` (dedupe by `orderId`)
4. Count attributions in rolling 14-day window
5. `tierFromCount` using `publisherTiers` from GlobalSettings
6. Floor always `P15` — never NONE for approved publishers
7. Call `ensurePublisherPromoForTier()` — rotate BC promo on tier change

**Webhook change:** `src/lib/bigcommerce/webhooks.ts` → `handleOrderEvent`:
- After existing reseller recalc, add publisher attribution path

**Cron:** `src/app/api/cron/tier-recalc/route.ts` → also run `recalcAllPublisherTiers()`

---

## 7. Homepage (`src/app/page.tsx`)

Add **before** any Apply CTA:

### Path chooser (two cards)
1. **Resell & fulfill** → `/apply/reseller` — existing story (tax-free, tiers to 30%, drop-ship)
2. **Promote to your audience** → `/apply/publisher` — AWIN commission, 15–25% audience codes

Add dual sections: How it works, Benefits, Tier tables, FAQ (tabbed or split).

Update `src/app/layout.tsx` meta/SEO for dual audience.

Update login copy (`src/app/login/page.tsx`): "Partner Portal" not wholesale-only.

---

## 8. Application flows

### Routes
- `/apply/reseller` — move/refactor existing form; set `partnerType: DROPSHIPPER`
- `/apply/publisher` — new form
- `/apply` — redirect to chooser or `?type=`

### Publisher apply fields
| Field | Required |
|-------|----------|
| firstName, lastName, email, phone | Yes |
| companyName (brand name) | Yes |
| promoWebsite | Yes (URL) |
| promoTypes | Yes (multi-select) |
| promoDescription | Yes |
| primaryState / regions | Yes |
| audienceReach | Optional dropdown |
| awinJoined (boolean) | Yes |
| awinPublisherId | If joined |
| attestation (publisher terms) | Yes |

**Skip:** resale cert requirement at apply; drop-ship language.

### API: extend `src/app/api/apply/route.ts`
- Accept `partnerType` + publisher fields
- Store `partnerType` on `WholesaleAccount`
- Branch emails (see §10)

**On approve (publisher):** do NOT assign Wholesale BC group. Do NOT run welcome 20%. Set `lastTier: P15`, create P15 audience promo immediately.

**Publishers:** BC customer optional (portal identity only); tier does not use `customer_id`.

---

## 9. Portal dashboard & nav

### Branch in `src/app/(portal)/layout.tsx` on `user.wholesaleAccount.partnerType`

**Reseller nav (unchanged):** Dashboard, Hot Sellers, Orders, Tracking, Insights, Margin Calculator, Documents, Profile, Team, Support, Terms

**Publisher nav:**
| Route | Purpose |
|-------|---------|
| `/dashboard` | Code, AWIN link, tier progress, onboarding |
| `/performance` | NEW — attributed orders (14d window) |
| `/share-kit` | NEW — copy blocks, instructions |
| `/hot-sellers` | Optional — products to promote |
| `/profile` | Include AWIN publisher ID |
| `/support`, `/terms` | Publisher terms variant |

**Hide from publishers:** margin-calculator, documents, tracking, reseller checkout CTAs, store credit, welcome countdown.

**Publisher dashboard widgets:**
- Active audience code (copy)
- AWIN link + "use together" warning
- Tier: X orders in 14d → next tier at 50 / 125
- Recent attributed orders
- Publisher onboarding checklist

Fork or gate: `dashboard/page.tsx`, `dashboard-onboarding.tsx`, `orders/page.tsx` (show attributed orders for publishers).

---

## 10. Emails (`src/lib/email.ts`)

### New functions
- `sendPublisherApplicationReceivedEmail`
- `sendPublisherApprovalEmail` — login, P15 code, AWIN link, share guidelines
- `sendPublisherDenialEmail`
- `sendPublisherMoreInfoRequestEmail`
- `sendPublisherTierChangedEmail` — **critical:** new code, old code disabled, update your offers
- `sendPublisherCouponChangedEmail` (or branch existing `sendCouponChangedEmail`)

### Branch existing admin notify
- `sendNewApplicantNotification` — include partner type badge

### Do NOT send publishers
- `sendWelcomeDiscountExpiringEmail`
- `sendCouponDisabledEmail` for dropping below P15 (should never happen)

---

## 11. Admin

- `admin/applicants` — filter/tabs by partnerType; badge on rows
- `admin/applicants/[id]/approve` — branch: reseller path vs publisher path
- `admin/customers` — show partnerType; tier override uses publisher tiers for publishers
- `admin/settings` — edit `publisherTiers` + `publisherTierWindowDays` alongside existing tier config
- `verify-customer-group` — reseller only
- `recreate-promotions` — branch by promoKind
- `enroll-customer` — ask partner type

### Publisher approval checklist
- [ ] Promotion site/method fits auto parts
- [ ] On AWIN program (or invite before approve)
- [ ] AWIN publisher ID noted (manual verify until Accelerate API)
- [ ] Approve → P15 code + publisher approval email

---

## 12. Legal

- Split `src/components/terms-of-service.tsx` or add `/terms/publisher`
- **Reseller terms:** code exclusivity, no sharing (keep current)
- **Publisher terms:** codes intended for public audience; must use AWIN link; code rotates on tier change

Apply flow links correct terms per path.

---

## 13. Risk & abuse

Extend `src/lib/risk-detection.ts` for publishers:
- Burst redemptions (same code, many orders/hour)
- Do NOT block public sharing — that's the business model

---

## 14. Implementation phases (build in order)

### Phase 1 — Foundation
- [ ] Prisma migration (`partnerType`, publisher fields, `PublisherOrderAttribution`, `promoKind`)
- [ ] Homepage chooser + dual marketing sections
- [ ] `/apply/reseller` + `/apply/publisher` routes
- [ ] Extend apply API + application received emails
- [ ] All existing accounts default `DROPSHIPPER`

### Phase 2 — Admin & approval
- [ ] Applicant list filter/badge
- [ ] Publisher approve path (P15 promo, no Wholesale group, publisher approval email)
- [ ] Branch deny / request-info emails

### Phase 3 — Tier engine
- [ ] `publisher-promotions.ts` + `publisher-tier-engine.ts`
- [ ] Webhook attribution + 14-day recalc cron
- [ ] Tier change → code rotation + emails

### Phase 4 — Publisher dashboard
- [ ] Branch portal layout nav
- [ ] Publisher dashboard, performance page, share kit
- [ ] Publisher onboarding checklist

### Phase 5 — Polish
- [ ] Publisher terms
- [ ] Admin publisher tier config UI
- [ ] Tests for publisher tier floor, attribution, promo payload

### Phase 6 (later — requires AWIN Accelerate)
- [ ] Verify AWIN publisher ID via API
- [ ] Pull commission stats into dashboard

---

## 15. Testing requirements

- [ ] Publisher promo payload has empty `customer` / no Wholesale group
- [ ] Reseller promo still has Wholesale `group_ids` (regression)
- [ ] Publisher tier never goes below P15 for approved account
- [ ] Attribution dedupes by orderId
- [ ] Tier upgrade at 50 and 125 orders (14d window)
- [ ] Tier downgrade stops at P15
- [ ] Code rotation triggers email on tier change
- [ ] Apply API rejects invalid publisher URLs
- [ ] Nav hides reseller-only pages for publishers

Run: `npm test` and `npm run build` before each PR.

---

## 16. Constraints / do not break

1. **Existing drop shippers** — all current behavior unchanged after migration
2. **Wholesale coupon restriction** (commit `9704c8f`) — reseller promos only
3. **Do not commit** `.env`, secrets, or local audit scripts
4. **Match existing code style** — Next.js app router, Prisma, Resend emails, shadcn UI
5. **Minimize scope per PR** — follow phases above; one phase per PR preferred
6. **AWIN advertiser API** is on Access plan (403 on data) — don't block publisher portal on AWIN API

---

## 17. Environment variables (existing)

```
DATABASE_URL
BIGCOMMERCE_* (store hash, token)
RESEND_API_KEY
AWIN_ADVERTISER_ID=121802
```

No new env vars required for Phase 1–5.

---

## 18. Suggested first message for implementing agent

```
Read docs/AFFILIATE_PUBLISHER_IMPLEMENTATION.md in full before writing code.

Implement Phase 1 only:
- Prisma schema + migration
- Homepage path chooser + dual-audience sections on wholesale.theperfectpart.net
- /apply/reseller and /apply/publisher forms
- Extend POST /api/apply with partnerType branching
- Publisher application received email
- Default all existing accounts to DROPSHIPPER

Do not implement tier engine or publisher dashboard yet.
Run npm test && npm run build before finishing.
Do not push unless I ask.
```

---

## 19. Context from prior work (2026-07-24)

- User: The Perfect Part, AWIN advertiser ID **121802**, plan **Access** (API 403 until Accelerate upgrade)
- AWIN MCP configured in Cursor at `~/.secrets/affiliate-mcp` (separate from this portal)
- Reseller coupon leak fixed: wholesale promos restricted to BC Wholesale customer group
- User explicitly rejected drop-ship framing for publishers — publishers share **audience codes** + earn **AWIN commission**
- User confirmed: **15% floor always** for publishers; grow to 20%/25% with volume

---

*End of spec*
