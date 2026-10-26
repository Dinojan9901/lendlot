# Lendlot

A peer-to-peer rental marketplace: people list things they own (drills, tents, cameras, PA speakers…) and others rent them by the day.

**Live site:** https://lendlot.vercel.app — create an account to try it (sign up as an owner to list items).

## What it does

- **Catalogue** with full-text search, category filters and pagination — all state lives in the URL.
- **Item pages** with SEO/Open Graph metadata, structured data, and an accessible **availability calendar**.
- **Booking**: pick a date range → live price (10% off for 7+ days) → confirm. Double-booking is impossible, enforced by **PostgreSQL itself**.
- **Accounts and roles**: renters book, owners manage their own listings, admins manage users.
- **Dashboards**: "My bookings" (with cancellation), "My listings" (create, edit, hide) and an owner **earnings** dashboard (earned to date, upcoming revenue, revenue by month, upcoming bookings).
- **Membership**: a monthly subscription through **Paddle Billing** (sandbox) that gives 15% off every rental, kept in sync by an **idempotent webhook**.
- **REST API** for items and bookings, used by the client components.

## Tech stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS 4 · PostgreSQL 17 + Prisma 7 · Auth.js v5 · Zod 4 · Paddle Billing (sandbox) · Vitest + React Testing Library · Playwright + axe · Docker Compose · GitHub Actions · Vercel + Neon

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    RSC[Server-rendered HTML<br/>catalogue, item pages]
    CC[Client components<br/>calendar, booking panel,<br/>cancel / hide buttons]
  end
  subgraph Next.js on Vercel
    Proxy[proxy.ts<br/>auth + role redirect]
    Pages[Server Components<br/>'use cache' reads]
    Actions[Server Actions<br/>book, save listing, sign in]
    API[Route Handlers<br/>/api/items, /api/bookings, /api/me]
    Webhook["Webhook<br/>/api/webhooks/paddle"]
    Services[src/server<br/>bookings, listings, items,<br/>membership, earnings]
  end
  DB[(PostgreSQL<br/>exclusion constraint)]
  Paddle[(Paddle<br/>sandbox)]

  RSC --> Proxy --> Pages --> Services
  CC -- fetch --> API --> Services
  CC -- form --> Actions --> Services
  Actions -- transaction / portal --> Paddle
  Paddle -- signed events --> Webhook --> Services
  Services --> DB
```

```
prisma/              schema, migrations (incl. the hand-written constraint), seed
src/app/             routes: pages, layouts, Server Actions, Route Handlers
src/components/      UI (catalogue, booking, dashboard, forms)
src/lib/             pure logic shared by client and server: dates, pricing, Zod schemas
src/server/          server-only code: Prisma client, services, auth helpers
src/proxy.ts         Next 16 "middleware": protects /dashboard and /admin
tests/integration/   booking rules, concurrency, ownership, earnings, Paddle webhook (real Postgres)
tests/e2e/           Playwright user journeys + axe accessibility checks
```

Pages, Server Actions and Route Handlers are thin: they parse input with Zod, check who the user is, and call a service in `src/server`. All business rules (ownership, cancellation, pricing, conflicts) live in those services, so the UI and the API can't drift apart.

## Key decisions

### Double-booking is prevented by the database, not just the app

The obvious approach — "check whether the dates are free, then insert" — has a race condition. Two requests can both run the check, both see the dates as free, and both insert. Adding more app servers makes it worse.

Instead, the `Booking` table has a PostgreSQL **exclusion constraint** ([migration](prisma/migrations/20261013082305_booking_no_overlap/migration.sql)):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist ("itemId" WITH =, daterange("startDate", "endDate", '[]') WITH &&)
  WHERE ("status" = 'CONFIRMED');
```

It reads: _"no two confirmed rows may have the same item **and** overlapping date ranges."_ Postgres enforces this atomically using an index, however many requests arrive at once. `btree_gist` is needed so that one GiST index can combine equality on `itemId` with range overlap (`&&`). The `WHERE` clause means cancelled bookings free their dates.

The app therefore does **no** availability pre-check before inserting. It inserts, and if Postgres raises `23P01 exclusion_violation`, the service turns it into a friendly "those dates were just booked" message. An [integration test](tests/integration/concurrency.test.ts) fires 25 overlapping bookings at the same moment and asserts that exactly one succeeds and 24 get a conflict.

Prisma's schema language can't express exclusion constraints, so this lives in a hand-written migration. `prisma migrate diff` confirms Prisma leaves it alone.

**A race CI caught:** when overlapping inserts arrive at exactly the same instant, each can wait for the other's uncommitted row while checking the constraint, and Postgres resolves that deadlock by aborting one (`40P01`, reported by Prisma as `P2034`) after a 1-second wait, instead of raising `23P01`. No double booking gets through either way, but users would see errors. Retrying alone didn't fix it: under a burst the retries kept deadlocking each other. The fix is a short transaction that first locks the item row (`SELECT ... FOR UPDATE`), so concurrent bookings of the **same item queue up** and each hits the constraint cleanly, while different items still book in parallel. The constraint is still what guarantees correctness; the lock just makes conflicting writers line up, and a small deadlock retry remains as a safety net.

### Server Components by default, client components only where needed

- The catalogue, item pages and dashboards are **Server Components**: they query the database directly, ship no JavaScript for their content, and are fast to first paint and easy for search engines.
- **Client components** are used only for real interactivity: the calendar (keyboard navigation and selection), the live price preview, and the cancel/hide buttons.
- Search is a plain `GET` form (upgraded by `next/form`), so filtering works even before JavaScript loads.

### Server Actions for forms, Route Handlers for the API

- **Server Actions** handle form submissions (book, sign in/up, save a listing). They run only on the server, validate with Zod, and work as progressive enhancement: the booking form posts even without JavaScript. The **price is always recomputed on the server**; the client's preview is never trusted.
- **Route Handlers** (`/api/items`, `/api/bookings`) are a small REST API. Client components use them for live data that the cached page can't contain (availability) and for in-place updates (cancel a booking, hide a listing). They share the same services and Zod schemas as the actions.

### Caching and ISR with Cache Components

Next 16's Cache Components are enabled. Public reads are `"use cache"` functions with a `cacheLife` (time-based revalidation) and `cacheTag`s (on-demand revalidation). Item pages are prerendered for the newest items via `generateStaticParams`; other items are rendered on first visit and then cached — that is ISR in Next 16. Editing a listing calls `updateTag`, so the owner immediately sees their change.

Because the item page is cached, **availability is never baked into it**: the calendar fetches `/api/items/:id/availability` fresh. The only per-user part of the layout (the header's account menu) streams in behind `<Suspense>`, so it doesn't make every page dynamic.

### Authorisation: defence in depth

- `proxy.ts` (Next 16's renamed middleware) redirects signed-out users away from `/dashboard` and `/admin` and checks roles. It's a fast first gate, **not** the security boundary.
- Every page, Server Action and Route Handler checks again, and the role is **re-read from the database** rather than trusted from the session token. Role changes therefore take effect immediately.
- Owner writes go through one function that loads the item **scoped to the owner**. Another owner's item behaves exactly like a missing one (404), so ids can't be probed.

### Payment webhooks are idempotent and order-independent

Membership billing runs on **Paddle Billing in sandbox mode** (the client is hard-wired to `sandbox-api.paddle.com`, so it can never charge a real card). Paddle delivers webhooks **at least once** and **in no guaranteed order**, so the [handler](src/server/membership.ts) is built for both:

- **Signature first.** The `Paddle-Signature` header (`ts=…;h1=…`) must equal HMAC-SHA256 of `ts:rawBody` with the endpoint's secret, compared in constant time, with stale timestamps rejected ([code](src/server/paddle.ts)). The raw body is used exactly as received; re-serialised JSON wouldn't match.
- **Idempotent.** Each event's id is inserted into a `BillingEvent` table **in the same database transaction** as the change it causes. A redelivered event, or two copies arriving at once, hits the primary key and is skipped, all or nothing. The handler only answers 2xx after the commit, so Paddle's retries are always safe.
- **Out-of-order safe.** Each update records the event's `occurred_at`, and the write is a compare-and-set: an older event that arrives late can't overwrite newer state (e.g. a stale "active" after "canceled").
- **Server-created checkout.** The server creates the Paddle customer (linked to the user before checkout, so every webhook can find them) and the transaction (price, customer and user id); the browser only opens Paddle's overlay for that transaction id, so it can't change what is bought or who it's for. On return, the subscription is fetched and applied immediately, so the member doesn't wait for the webhook.
- **The discount is decided on the server** from the database (`ACTIVE` and the paid period not yet over), never from the client, and a missed "canceled" event can't grant the discount forever.
- **Provider-neutral core.** Only `src/server/paddle.ts` and one mapping function know Paddle's shapes. The membership logic and tables (`billingCustomerId`, `BillingEvent`) don't, which is how billing moved from Stripe to Paddle (Stripe isn't available in my country) without touching the idempotency or discount logic.

Unit tests cover signature verification (tampering, wrong secret, replays, secret rotation); integration tests send signed and forged requests to the real route: activation, past due, cancellation, sequential and simultaneous duplicates, and out-of-order delivery.
### Smaller decisions

- **Money is integer cents** — no floating-point rounding errors.
- **Dates are ISO strings (`2026-10-13`) with UTC arithmetic** — bookings are whole days, and this avoids "off by one day" timezone bugs. Postgres stores them as `DATE`.
- **Passwords** use Node's built-in `scrypt`, so there's no native dependency to break serverless builds.
- **Item images are generated** by a [script](scripts/generate-item-images.ts) rather than taken from stock photos: no licensing questions, no brand logos, works offline in CI.

## Accessibility

- Labels on every input, `aria-invalid` + `aria-describedby` for errors, and **focus moves to the first invalid field** after a failed submit.
- The calendar follows the WAI-ARIA grid pattern: one tab stop, arrow keys, Home/End, PageUp/PageDown. Booked days stay focusable and are announced as "booked" rather than silently disabled.
- Skip link, visible focus ring, live regions for result counts and calendar messages.
- Playwright runs **axe** (WCAG 2.1 A/AA) on the main pages in CI.

## Security

What's in place, mapped to the [OWASP Top 10:2025](https://owasp.org/Top10/). Reporting and CI checks are described in [SECURITY.md](SECURITY.md).

| OWASP category | What Lendlot does |
| --- | --- |
| **A01 Broken Access Control** | Every page, Server Action and Route Handler checks the user on the server. The role is re-read from the database, not trusted from the session token. Owner writes load the item scoped to its owner, and someone else's item behaves like a missing one (404). `proxy.ts` is only a first gate. Return URLs are restricted to same-site paths (no open redirects). |
| **A02 Security Misconfiguration** | A Content-Security-Policy that allows only this origin plus Paddle's script, styles and checkout frame, with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` and a restricted `form-action`. Also HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and no `X-Powered-By`. CI workflows get a read-only token. Trivy scans for misconfigurations. |
| **A03 Software Supply Chain Failures** | Dependabot (weekly, grouped), `npm audit` and Trivy dependency scanning in CI (fails on HIGH/CRITICAL), and CodeQL. The lockfile is committed. Trivy itself is installed from a checksum-pinned release rather than a third-party action. |
| **A04 Cryptographic Failures** | Passwords are hashed with scrypt (random salt, constant-time compare). Sessions are signed JWTs in `HttpOnly`, `Secure`, `SameSite=Lax` cookies. HSTS is on. Webhooks are verified with HMAC-SHA256 and a timing-safe comparison. Secrets live only in environment variables, and nothing secret is in the client bundle (only Paddle's public client token). |
| **A05 Injection** | Every input (forms, JSON bodies, URL params, bound action arguments, webhook payloads) is validated with Zod. Database access goes through Prisma's parameterised queries. React escapes output, and the one raw `<script type="application/ld+json">` is escaped. The CSP limits the damage of any XSS that slips through. |
| **A06 Insecure Design** | Double-booking is impossible at the database level (exclusion constraint). Prices and the member discount are computed on the server. Paddle checkouts are created on the server, so the browser can't change what is bought. Write endpoints are rate-limited. |
| **A07 Authentication Failures** | Sign-in is rate-limited per IP + email and per IP (on the form *and* on the raw Auth.js endpoint), with a generic "incorrect email or password" message. Login takes the same time whether or not the email exists, so timing can't reveal accounts. Sample accounts on the live site use a private password. |
| **A08 Software or Data Integrity Failures** | Paddle webhooks need a valid signature within a 5-minute window, are schema-validated even when signed, and are processed idempotently (each event id is stored in the same transaction as its effect) and order-safely. |
| **A09 Logging & Alerting Failures** | Unexpected errors and webhook failures are logged server-side (Vercel logs), without being shown to users. *Not done:* alerting, and a security audit log of admin actions. |
| **A10 Mishandling of Exceptional Conditions** | API errors use one generic shape (no stack traces). Pages fall back to error boundaries that show only a reference id. Malformed webhooks get a 400. If Upstash is unreachable, rate limiting falls back to the in-memory limiter instead of failing open or locking everyone out. |

### Rate limits

| What | Limit | Keyed by |
| --- | --- | --- |
| Sign-in (form and `/api/auth/callback/credentials`) | 10 / 10 min, and 50 / 10 min | IP + email, and IP |
| Registration | 5 / hour | IP |
| Booking (Server Action and `POST /api/bookings`) | 10 / min | user |
| Membership checkout / billing portal | 5 / 10 min | user |
| Other writes (listings, cancellations, visibility, roles) | 30 / min | user |

Route Handlers answer `429 Too Many Requests` with `Retry-After`; forms show the same message inline. In production the counters live in [Upstash Redis](https://upstash.com) (shared by all serverless instances). Without the Upstash env vars (local dev, tests, CI) an in-memory sliding window enforces the same limits per process.

### Why the CSP isn't nonce-based

A per-request nonce forces every page to render dynamically, and Next.js documents that this disables static rendering, ISR and Partial Prerendering. The catalogue and item pages rely on those (they're why Lighthouse scores 96–100). So the CSP is a static header: scripts may come only from this origin and Paddle's CDN, and `'unsafe-inline'` is allowed only for the inline bootstrap scripts and styles Next.js emits. If the pages ever become fully dynamic, the policy can switch to nonces in `src/proxy.ts`.

## Lighthouse

Measured on the live site by a [GitHub Actions workflow](.github/workflows/lighthouse.yml) that runs after every production deploy (Lighthouse 12, median of 3 runs, on GitHub's runners). Performance is **96–100** on every page and device; accessibility, best practices and SEO are 100.

| Page                                                                    | Device  | Performance | Accessibility | Best practices | SEO |
| ----------------------------------------------------------------------- | ------- | ----------- | ------------- | -------------- | --- |
| [Catalogue](https://lendlot.vercel.app/)                                | Mobile  | 98          | 100           | 100            | 100 |
| [Catalogue](https://lendlot.vercel.app/)                                | Desktop | 100         | 100           | 100            | 100 |
| [Item page](https://lendlot.vercel.app/items/cordless-drill-driver-kit) | Mobile  | 96          | 100           | 100            | 100 |
| [Item page](https://lendlot.vercel.app/items/cordless-drill-driver-kit) | Desktop | 100         | 100           | 100            | 100 |

Measured on 2026-10-25 (commit `c6492ef`). Mobile scores move by a point or two between runs. A run that hits a Lighthouse trace error is retried, and the job summary shows how many runs succeeded. The workflow's job summary and HTML reports have the latest numbers.

## Running locally

Requirements: Node 22+, Docker.

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET (npx auth secret)
npm run db:up                 # Postgres 17 on localhost:5433 (+ a test database)
npx prisma migrate deploy     # create tables and the exclusion constraint
npm run db:seed               # 24 sample listings + sample accounts (password: lendlot-demo)
npm run dev                   # http://localhost:3000
```

Membership is optional locally. To try it, create a free [Paddle sandbox](https://sandbox-login.paddle.com/signup) account, add `PADDLE_API_KEY` and `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (`test_…`) to `.env`, set a default payment link under *Checkout settings*, and run `npm run billing:setup` to create the $9/month price (it prints `PADDLE_PRICE_ID`). Test card: `4242 4242 4242 4242`, any future expiry.

## Tests

| Command                              | What it runs                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `npm test`                           | Unit + component tests (Vitest, React Testing Library, jsdom)                                 |
| `npm run test:integration`           | Booking rules, ownership, earnings, the Paddle webhook and the **concurrency test** against real Postgres |
| `npm run test:e2e`                   | Playwright: builds the app, seeds the test DB, runs the user journeys + axe checks            |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript                                                                           |

GitHub Actions runs all of the above on every push and pull request ([workflow](.github/workflows/ci.yml)), and Lighthouse after every production deploy.

## Deployment

Vercel hosts the app; Neon provides Postgres (it supports `btree_gist`). The `vercel-build` script runs `prisma migrate deploy` before `next build`. Required environment variables: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct, used for migrations) and `AUTH_SECRET`. For membership also `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_ID` and `PADDLE_WEBHOOK_SECRET` (all sandbox); `npm run billing:setup -- --webhook-url=https://<domain>/api/webhooks/paddle` creates the price and the webhook destination. When seeding a deployed database, set `SEED_DEMO_PASSWORD` so the sample accounts there don't use the public development password.
