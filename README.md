# ZYREX STORE — Multi-category Online Shopping Marketplace

A complete, working e-commerce application: React storefront, Express API, an Indian
checkout with Razorpay test-mode integration, order lifecycle management, and a
role-protected administrator dashboard.

Brand name, colours, contact details and commerce rules are configurable from the
admin dashboard (Settings) and from environment variables.

> **Demo data notice.** The catalogue ships with clearly labelled sample products and
> demo prices so the store is usable immediately. Replace them with real inventory
> before selling. Product imagery is original generated artwork served by the app —
> no third-party or copyrighted photography is used.

---

## 1. Main features

**Storefront**
- Premium responsive home page: announcement bar, hero, featured categories, trending,
  bestsellers, new arrivals, today's deals, category collections, recently viewed,
  customer reviews, blog/vlog previews, newsletter, full footer.
- 10 categories with subcategories, dedicated category pages, filters (category, price,
  brand, rating, discount, availability, size, colour) and six sort orders.
- Search with suggestions, no-results states and shareable query URLs.
- Product detail pages: gallery, specs, size/colour selection enforced before cart,
  stock, delivery estimate, return policy, reviews, related and frequently-bought items.
- Cart, wishlist and product comparison with server-side totals.
- Checkout with saved addresses, coupons, delivery rules, Razorpay (UPI/card/netbanking)
  and Cash on Delivery.
- Accounts: register, login, email verification, password reset, profile, addresses,
  order history, order tracking timeline, cancellation and return requests.
- Blog, vlog, FAQ, help centre, policies, about and contact pages. 404 page.

**Admin**
- Dashboard statistics, 14-day sales chart, status breakdown, bestsellers, low stock.
- Product CRUD with image upload (content-type verified), categories and subcategories.
- Order management: status transitions with timeline, payment status, stock restoration.
- Customer list with order value, admin role management.
- Coupons and campaigns, blog/vlog publishing, support tickets with replies,
  review moderation, store settings.

**Non-functional**
- Light and dark mode, lazy-loaded images, skeleton loaders, error boundaries,
  empty states, PWA manifest + offline fallback, English/Bengali i18n scaffold.

## 2. Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite + React Router |
| Styling | Tailwind CSS v4 (design tokens in `src/index.css`) |
| Backend | Node.js + Express 5 (same process serves the SPA and the API) |
| Data | JSON document store with atomic writes (default) or Supabase PostgreSQL |
| Auth | Server-side sessions: bcrypt password hashes + signed JWT in an HttpOnly cookie |
| Payments | Razorpay Orders API + server-side signature verification |
| Hosting | AppJet (Docker, Alpine Node image) |

## 3. Architecture

```
Browser ──► Express (server/index.js)
              ├─ /api/*            JSON API (auth, catalogue, cart, orders, admin)
              ├─ /api/img/*        generated product/category artwork (SVG, cached)
              ├─ /api/uploads/*    admin-uploaded images
              └─ *                 built SPA from dist/ (client-side routing)
```

One process, one port (`process.env.PORT`, default 3000). The server binds `0.0.0.0`.
Money is always recalculated on the server; the browser never sends prices.

`server/store.js` provides `table/insert/update/find/filter/remove` over a JSON file
with atomic writes. It is the default adapter so the app runs with zero credentials.
`supabase/schema.sql` contains the equivalent PostgreSQL model (tables, indexes,
constraints, RLS policies) for moving to Supabase.

## 4. Folder structure

```
server/            Express app
  index.js         server bootstrap, static hosting, SPA fallback
  store.js         data adapter + persistence
  seed.js          categories, ~169 demo products, coupons, blog/vlog, settings
  images.js        generated SVG artwork endpoint
  payments.js      Razorpay order creation + signature verification
  routes/          auth, products, cart, orders, content, admin
src/
  pages/           Home, Shop, Categories, Product, Cart, Wishlist, Compare,
                   Checkout, Auth, Account, Orders, AdminLogin, Admin, Content, NotFound
  components/      Layout, ProductCard, ui primitives, guards (ErrorBoundary, RequireAuth…)
  context/         StoreProvider (session, cart, wishlist, compare, settings, toasts)
  lib/             api client, formatting helpers, i18n scaffold
supabase/schema.sql  PostgreSQL schema + RLS
scripts/test-api.mjs API smoke tests
```

## 5. Installation

```bash
npm install
cp .env.example .env      # then edit values
npm run dev               # Vite dev server on :5173, proxies /api to :3000
npm run dev:api           # API on :3000 (run in a second terminal)
```

Production:

```bash
npm run build             # builds the SPA into dist/
npm start                 # Express serves dist/ + the API on $PORT
```

## 6. Environment variables

All variables are optional for a local demo; the app degrades honestly when they are
missing (for example, online payment stays disabled instead of faking success).

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default 3000) |
| `NODE_ENV` | `production` enables secure cookies |
| `JWT_SECRET` | Signs session tokens. **Set this in production.** |
| `PUBLIC_SITE_URL` | Canonical site URL |
| `DATA_DIR` | Data directory (default `./data`) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | PostgreSQL/Auth/Storage connection (server-side only) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay credentials (test keys start `rzp_test_`) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification |
| `VITE_RAZORPAY_KEY_ID` | Public key id used by the browser checkout |
| `ENABLE_COD`, `SHIPPING_FLAT_FEE`, `FREE_SHIPPING_THRESHOLD` | Delivery defaults |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Transactional email (verification, order updates) |

Never commit a real `.env`. In AppJet add them under **Settings → Environment variables**.

## 7. Supabase configuration

1. Create a project at supabase.com (free tier is sufficient).
2. Run `supabase/schema.sql` in the SQL editor. It creates every table, index,
   constraint, trigger and Row Level Security policy.
3. Copy the project URL, anon key and service-role key into the environment variables.
4. The service-role key is **server-only** — it must never be exposed to the browser or
   committed to Git.

RLS summary: customers read/update only their own profile, addresses, cart, wishlist,
orders and reviews; product and category tables are publicly readable but writable only
by administrators (`profiles.role = 'admin'`); coupons and inventory are admin-only.

## 8. Authentication

- Passwords are hashed with bcrypt (cost 10+); plaintext is never stored or logged.
- Sessions are signed JWTs delivered in an `HttpOnly`, `SameSite=Lax` cookie
  (`Secure` in production).
- Roles live in the database; `/api/admin/*` rejects non-admin tokens server-side, so
  hiding a tab is never the protection.
- Password reset uses single-use, time-limited tokens.
- Email verification links require `EMAIL_API_KEY`; without it the account is created
  unverified and the UI says so rather than pretending an email was sent.

## 9. Razorpay test mode

1. Create a Razorpay account and switch to **Test mode**.
2. Copy the test `key_id`/`key_secret` into the environment.
3. Checkout flow: server creates the order and a Razorpay order → browser opens the
   gateway → server verifies the `razorpay_signature` with HMAC-SHA256 → only then is
   the order marked paid. Failed/cancelled payments release reserved stock.
4. Card numbers and CVV never touch this application.

Live payments require an activated merchant account and approved business details.
Test-mode keys cannot capture real money.

## 10. Admin setup

- Seed administrator: **admin@zyrexstore.in / Admin@12345** — change this password
  immediately in production (or set your own seed credentials before first start).
- Admin sign-in: `/admin/login`, dashboard: `/admin`.
- Promote another account to admin from Admin → Customers → Role.

## 11. Database setup

Default: the JSON store initialises itself on first start (`data/db.json`).
PostgreSQL: run `supabase/schema.sql`, then point the adapter at Supabase with the
environment variables above. The schema mirrors the JSON collections one-to-one
(`products`, `cart_items`, `orders`, `coupons`, …) so the API contract is unchanged.

## 12. GitHub workflow

The project lives in the existing `Online-Shopping-WEB` repository on branch `appjet`.
Every change is committed and pushed automatically. Secrets are never committed —
`.gitignore` excludes `.env` and `data/`.

## 13. Deployment

`Dockerfile` builds the SPA and runs `node server/index.js` on `$PORT` (Alpine Node
image, non-root user). On AppJet: set the environment variables, ensure the deployment
port matches `PORT`, then deploy. The server must listen on `0.0.0.0` — a localhost
bind causes a 502.

**Services that are not part of the frontend deployment:** Razorpay needs its keys in
the same environment; Supabase needs its URL and keys; transactional email needs a
provider. Deploying the frontend does not provision those accounts.

## 14. Testing

```bash
npm test        # API smoke tests (catalogue, auth, cart, coupon, order, admin guards)
npm run build   # production build must succeed
```

Covered: health, catalogue listing/filtering, product detail, registration/login,
session, cart add/update, coupon validation, order creation and totals, admin
authorisation rejection for customers, 404 behaviour.

## 15. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| 502 after deploy | Server bound to `127.0.0.1` or wrong `PORT` |
| Online payment greyed out | `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` missing |
| Cart totals differ from the UI | Stock or price changed — refresh; the server is authoritative |
| Admin pages 403 | Account role is `customer`; promote it in Admin → Customers |
| Images missing | Generated artwork needs `/api/img/*`; check the server is running |
| "Not authorised" on refresh | Session cookie expired — sign in again |

## 16. Known limitations

- Catalogue, coupons and content are demonstration data with demo prices.
- Email delivery, SMS and real payment capture need provider credentials.
- Recommendations are rule-based (category, brand, price band) — not machine learning.
- Bengali is an i18n scaffold (strings wired, translations incomplete).
- Hosting is a single 1 GB / 1 vCPU container on the Free plan; it is intended for
  development and testing rather than production-scale traffic.

## 17. Future improvements

Supabase migration of the adapter, server-side image resizing, webhook-driven refunds,
loyalty points and referrals, wishlist sharing, order invoices as PDF, and a fuller
Bengali translation set.
