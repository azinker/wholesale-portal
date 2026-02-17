# The Perfect Part — Wholesale Portal

A Next.js 15 application for managing wholesale customer accounts, tiered discount promotions, and document uploads — integrated with BigCommerce, Neon Postgres, Cloudflare R2, ClamAV, and Resend.

## Architecture

```
Customer Portal (wholesale.theperfectpart.net)
├── Magic-link login (Resend email)
├── Application form → auto-creates BC customer
├── Dashboard with tier progress + coupon codes
├── Document upload (R2 → ClamAV scan)
└── Order history (BC API)

Admin Portal (/admin)
├── Applicant review → Approve / Deny
├── Customer group assignment (BC API)
├── Tier engine (rolling 7-day recalc every 4hrs)
├── Risk flag detection queue
├── Promo audit tool
└── Full audit log
```

## Tech Stack

| Component | Service |
|-----------|---------|
| Framework | Next.js 15 (App Router, React 19) |
| Styling | Tailwind CSS 4 + shadcn/ui components |
| Database | Neon Postgres + Prisma ORM |
| Auth | Magic-link (JWT + HttpOnly cookies) |
| Email | Resend |
| Storage | Cloudflare R2 (quarantine → clean pipeline) |
| AV Scan | ClamAV (Railway, INSTREAM protocol) |
| E-commerce | BigCommerce V2/V3 REST API |
| Hosting | Vercel |

## Local Development

### Prerequisites

- Node.js 20.x
- npm

### Setup

```bash
cd wholesale-portal
npm install
npx prisma generate
npx prisma db push     # sync schema to Neon
npm run db:seed         # seed sample data
npm run dev             # http://localhost:3001
```

### Environment Variables

Copy `.env.example` to `.env` and fill in all values. Key variables:

- `TARGET_STORE` — `dev` or `prod` (controls which BC credentials are used)
- `PRODUCTION_WRITES_ENABLED` — `false` by default (blocks writes to prod BC)
- `BC_DEV_*` / `BC_PROD_*` — BigCommerce API credentials per environment
- `DATABASE_URL` — Neon Postgres connection string
- `R2_*` — Cloudflare R2 credentials and endpoint
- `RESEND_API_KEY` — Email sending (required for magic links and **Support** tickets to `wholesale@theperfectpart.net`)
- `EMAIL_FROM` — Sender address (default `no-reply@wholesale.theperfectpart.net`); domain must be [verified in Resend](https://resend.com/docs/dashboard/domains/introduction) or emails may not be delivered
- `CLAMAV_HOST` / `CLAMAV_PORT` — ClamAV connection (Railway)
- `JWT_SECRET` — For session/magic-link tokens
- `ADMIN_ALLOWLIST` — Comma-separated admin emails

### Testing

```bash
npm test          # Vitest unit tests
npm run test:e2e  # Playwright E2E (requires running server)
```

## Deployment to Vercel

### 1. Create Vercel project

```bash
npx vercel
```

### 2. Set environment variables

In the Vercel dashboard, add all variables from `.env`. Change:
- `TARGET_STORE=prod` (when ready)
- `NEXT_PUBLIC_APP_URL=https://wholesale.theperfectpart.net`

### 3. Build command

Vercel auto-detects Next.js. Ensure the build command includes Prisma:

```
npx prisma generate && next build
```

### 4. Custom domain

Add `wholesale.theperfectpart.net` as a custom domain in Vercel project settings.
CNAME record: `wholesale → cname.vercel-dns.com` (already added in GoDaddy).

### 5. Cron job

The `vercel.json` configures a cron to run tier recalculation every 4 hours:

```json
{
  "crons": [{ "path": "/api/cron/tier-recalc", "schedule": "0 */4 * * *" }]
}
```

Add `CRON_SECRET` env var in Vercel to secure the endpoint.

### Support emails not reaching wholesale@theperfectpart.net?

Support tickets are sent via Resend to `wholesale@theperfectpart.net`. If the inbox never receives them:

1. **Verify the sending domain in Resend** — In [Resend Dashboard → Domains](https://resend.com/domains), add and verify the domain used in `EMAIL_FROM` (e.g. `wholesale.theperfectpart.net`). Add the DNS records Resend provides (SPF, DKIM). Until the domain is verified, Resend may reject sends or they may not be delivered.
2. **Check `RESEND_API_KEY`** — In Vercel (or your host), ensure `RESEND_API_KEY` is set and valid. If it’s missing or wrong, the Support API returns 500 and the user sees "Failed to send message."
3. **Check server logs** — On send failure, the support API logs the Resend error (e.g. "domain not verified"). Check Vercel logs for "Failed to send support email" and "Resend error detail".
4. **Spam** — Ask the team to check spam/junk for `wholesale@theperfectpart.net`.

## BigCommerce Webhooks

Register webhooks via Admin > Settings, or use the API:

| Scope | Purpose |
|-------|---------|
| `store/customer/created` | Auto-detect wholesale form field → create application |
| `store/customer/updated` | Re-check wholesale form field |
| `store/order/statusUpdated` | Trigger tier recalculation |
| `store/order/created` | Capture new orders |

Webhook URL: `https://wholesale.theperfectpart.net/api/webhooks/bigcommerce`

For local testing, use ngrok:
```bash
ngrok http 3001
# Then register webhook with https://xxxx.ngrok-free.app/api/webhooks/bigcommerce
```

## Tier System

| Tier | Discount | Requirement |
|------|----------|-------------|
| None | 0% | < 25 paid US orders / 7 days |
| T10 | 10% | 25–50 paid US orders / 7 days |
| T15 | 15% | 51–100 paid US orders / 7 days |
| T20 | 20% | 101+ paid US orders / 7 days |

**Qualifying criteria:**
- Order must be paid (Shipped or Completed status)
- Must have at least one shipment (fulfillment proof)
- Billing address must be US
- Rolling 7-day window, recalculated every 4 hours

## Production Launch Checklist

1. [ ] Set `TARGET_STORE=dev` and test full flow on dev store
2. [ ] Create "Wholesale" customer group in prod BC store
3. [ ] Verify Cloudflare R2 bucket exists and is accessible
4. [ ] Verify ClamAV is reachable from Vercel
5. [ ] Verify Resend domain is verified for `@wholesale.theperfectpart.net`
6. [ ] Deploy to Vercel with prod env vars
7. [ ] Set custom domain `wholesale.theperfectpart.net`
8. [ ] Register webhooks on prod store
9. [ ] Submit test application, verify email delivery
10. [ ] Approve test applicant, verify BC group assignment
11. [ ] Switch `TARGET_STORE=prod` and `PRODUCTION_WRITES_ENABLED=true`
12. [ ] Run promo audit to flag any retail promos needing wholesale exclusion
13. [ ] Monitor audit log for first real applications

## Rollback Plan

1. Set `PRODUCTION_WRITES_ENABLED=false` to immediately stop all BC writes
2. Switch `TARGET_STORE=dev` to redirect API calls to dev store
3. Revert Vercel deployment to previous version if UI issues
4. Database: Neon has point-in-time restore if data issues
