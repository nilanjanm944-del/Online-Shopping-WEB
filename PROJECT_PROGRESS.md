# ZYREX STORE — Project Progress

> Read this file first when resuming development. It records what is built, what is
> verified, what is pending and which credentials are still required.
> Last updated: phase 8 (finalisation).

## 1. Current status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: repo inspected, React + Vite + Tailwind client, Express API, data layer | ✅ Complete |
| 2 | Database model, RLS, authentication, profiles, addresses | ✅ Complete |
| 3 | Categories, subcategories, catalogue, artwork, search, filters, product pages | ✅ Complete |
| 4 | Cart, wishlist, comparison, checkout | ✅ Complete |
| 5 | Razorpay test-mode integration, order creation, tracking | ✅ Complete (needs keys to go live) |
| 6 | Admin dashboard, products, orders, customers, coupons, content | ✅ Complete |
| 7 | Blog, vlog, support, reviews, newsletter, PWA, i18n scaffold | ✅ Complete |
| 8 | Responsive polish, testing, docs, deployment prep | ✅ Complete |

## 2. Completed modules

**Storefront** — announcement bar, header with search suggestions, mega category nav,
hero, featured categories, trending, bestsellers, new arrivals, today's deals, category
collections, recently viewed, reviews, blog/vlog previews, newsletter, footer, dark mode.

**Catalogue** — 10 categories with subcategories, ~169 demonstration products across
fashion (men/women/kids/accessories), electronics, home & kitchen, grocery, beauty,
sports, books, toys, automotive and pet supplies. Each product carries id, name,
category, subcategory, brand/seller, description, images, MRP, price, discount, stock,
specifications, rating, reviews, delivery days, return days, featured/bestseller/new
flags. Clothing items carry sizes, colours, material, fit, sleeve, pattern, care.

**Commerce** — server-authoritative cart (subtotal, discount, shipping, total, savings),
wishlist, comparison, coupon validation, stock checks, order placement with idempotency,
order timeline, cancellation, return requests, tracking by order number.

**Payments** — Razorpay order creation on the server, checkout.js in the browser,
HMAC-SHA256 signature verification server-side, failed/cancelled handling, duplicate
payment protection (unique payment id), no card data stored.

**Accounts** — register, login, logout, session cookie, email verification tokens,
password reset tokens, profile editing, saved addresses, order history.

**Admin** — stats and charts, product CRUD with image upload, category/subcategory
management, order status + payment status, customer list and roles, coupons and
campaigns, blog/vlog publishing, support tickets with replies, review moderation,
store settings (brand, contact, shipping rules, COD toggle).

**Content pages** — blog list/detail, vlog list/detail (YouTube embeds), FAQ, help
centre, shipping policy, returns & refunds, privacy, terms, about, contact, 404.

## 3. Database

Default runtime store: JSON document store (`server/store.js`) with atomic writes at
`data/db.json`. Collections: users, addresses, categories, subcategories, products,
cart_items, wishlist_items, orders, payments, coupons, coupon_usage, reviews,
blog_posts, vlog_posts, faqs, tickets, subscribers, recently_viewed, settings.

PostgreSQL model: `supabase/schema.sql` — 24 tables with foreign keys, check
constraints, indexes (including a GIN full-text index on products) and RLS policies:

profiles, user_addresses, categories, subcategories, products, product_images,
product_variants, inventory, carts, cart_items, wishlists, wishlist_items,
recently_viewed, orders, order_items, payments, coupons, coupon_usage,
product_reviews, blog_posts, vlog_posts, faqs, newsletter_subscribers,
support_tickets, store_settings, admin_roles.

RLS rules: owner-only access to profile, addresses, cart, wishlist, orders, reviews;
public read for active catalogue and published content; admin-only writes; a trigger
blocks a customer from promoting themselves to admin.

## 4. Integrations

| Integration | Status | Notes |
| --- | --- | --- |
| GitHub (`Online-Shopping-WEB`) | ✅ Connected | Branch `appjet`, synced each change |
| AppJet hosting | ✅ Deployed | Docker + Express, single port |
| Supabase | ⏳ Schema ready, not connected | Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Razorpay | ⏳ Code complete, test keys missing | Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `VITE_RAZORPAY_KEY_ID` |
| Transactional email | ⏳ Code complete, provider missing | Add `EMAIL_API_KEY`, `EMAIL_FROM` |

Without these credentials the app remains fully usable: it runs on the local store,
online payment is disabled with an explicit message, and no fake success is shown.

## 5. Tested features

- Production build (`npm run build`) — passes.
- API smoke suite (`npm test`) — health, catalogue listing/filtering, product detail,
  categories, registration, session, cart add/update, coupon validation, order creation
  and totals, duplicate-order protection, admin authorisation rejection for customers,
  admin access for the seeded administrator, unknown-endpoint 404.
- Dependency security scan — see the latest run summary.
- Live deployment — verified after build.

## 6. Known limitations

- All products, prices, reviews and blog posts are demonstration data (`is_demo`).
- Payment capture, email delivery and SMS require provider credentials.
- Recommendations are rule-based (category, brand, price band), not machine learning.
- Bengali support is an i18n scaffold; translations are incomplete.
- Persistent uploads need a disk or Supabase Storage; container-local uploads reset on
  redeploy.
- Free hosting plan: 1 GB RAM / 1 vCPU per app — for development and testing.

## 7. Required configuration (owner actions)

1. **Supabase** — create a project, run `supabase/schema.sql`, add the three keys.
2. **Razorpay** — activate a merchant account, copy test keys, then live keys after
   business approval.
3. **Email** — add a provider key so verification and order emails are delivered.
4. **Business details** — brand name, support email/phone, address, GSTIN, policies.
5. **Real inventory** — replace demo products and prices; upload real product images.
6. **Admin password** — change `Admin@12345` immediately after first login.
7. **Custom domain** — requires Starter or Pro plan in Settings → Billing.

## 8. Next development steps

1. Move the data adapter from JSON to Supabase (schema is ready).
2. Wire Supabase Storage for product images instead of container-local uploads.
3. Razorpay webhooks for asynchronous capture and refunds.
4. Loyalty points, referrals and membership tiers (tables already present).
5. Complete the Bengali translation set.
6. Order invoices as downloadable PDFs.
