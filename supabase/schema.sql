-- ===========================================================================
-- ZYREX STORE — Supabase PostgreSQL schema
-- Run this in the Supabase SQL editor (Database -> SQL editor -> New query).
-- Creates every table, index, constraint, trigger and Row Level Security policy.
--
-- Security model
--   * Public (anon) may READ the catalogue: categories, subcategories, products,
--     product_images, product_variants, inventory, blog_posts, vlog_posts, faqs.
--   * A signed-in customer may read/write only rows where user_id = auth.uid().
--   * Administrators (profiles.role = 'admin') may manage everything.
--   * The service-role key bypasses RLS and must stay server-side only.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True when the caller is an administrator. SECURITY DEFINER so the policy can
-- read profiles without recursing through profiles' own RLS policy.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth.users record)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         text,
  phone         text,
  role          text not null default 'customer' check (role in ('customer', 'admin')),
  avatar_url    text,
  locale        text not null default 'en' check (locale in ('en', 'bn')),
  reward_points integer not null default 0 check (reward_points >= 0),
  referral_code text unique,
  email_verified boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Addresses
-- ---------------------------------------------------------------------------

create table if not exists public.user_addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  label         text default 'Home',
  full_name     text not null,
  phone         text not null,
  line1         text not null,
  line2         text,
  landmark      text,
  city          text not null,
  state         text not null,
  pincode       text not null check (pincode ~ '^[0-9]{5,6}$'),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists user_addresses_user_idx on public.user_addresses (user_id);

drop trigger if exists user_addresses_updated_at on public.user_addresses;
create trigger user_addresses_updated_at before update on public.user_addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text,
  icon          text,
  image_url     text,
  banner_url    text,
  accent        text,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.subcategories (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories(id) on delete cascade,
  slug          text not null,
  name          text not null,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (category_id, slug)
);

create index if not exists subcategories_category_idx on public.subcategories (category_id);

create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  category_id     uuid not null references public.categories(id) on delete restrict,
  subcategory_id  uuid references public.subcategories(id) on delete set null,
  brand           text,
  seller          text,
  description     text,
  highlights      text[] default '{}',
  specifications  jsonb not null default '{}'::jsonb,
  mrp             numeric(12,2) not null check (mrp >= 0),
  price           numeric(12,2) not null check (price >= 0),
  discount_pct    integer not null default 0 check (discount_pct between 0 and 95),
  currency        text not null default 'INR',
  stock           integer not null default 0 check (stock >= 0),
  low_stock_at    integer not null default 5,
  rating          numeric(2,1) not null default 0 check (rating between 0 and 5),
  rating_count    integer not null default 0,
  sold_count      integer not null default 0,
  sizes           text[] default '{}',
  colors          text[] default '{}',
  material        text,
  fit             text,
  sleeve          text,
  pattern         text,
  care            text,
  is_featured     boolean not null default false,
  is_bestseller   boolean not null default false,
  is_new_arrival  boolean not null default false,
  is_active       boolean not null default true,
  delivery_days   integer not null default 4,
  return_days     integer not null default 7,
  is_demo         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_subcategory_idx on public.products (subcategory_id);
create index if not exists products_price_idx on public.products (price);
create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_rating_idx on public.products (rating desc);
create index if not exists products_active_idx on public.products (is_active) where is_active;
create index if not exists products_search_idx on public.products
  using gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(description,'')));

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  alt         text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id);

create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  size        text,
  color       text,
  sku         text unique,
  price_delta numeric(12,2) not null default 0,
  stock       integer not null default 0 check (stock >= 0),
  created_at  timestamptz not null default now(),
  unique (product_id, size, color)
);

create table if not exists public.inventory (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade unique,
  quantity     integer not null default 0 check (quantity >= 0),
  reserved     integer not null default 0 check (reserved >= 0),
  reorder_level integer not null default 5,
  warehouse    text default 'default',
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cart and wishlist
-- ---------------------------------------------------------------------------

create table if not exists public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade unique,
  coupon_code text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references public.carts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  qty         integer not null default 1 check (qty between 1 and 10),
  size        text,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, product_id, size, color)
);

create index if not exists cart_items_user_idx on public.cart_items (user_id);

create table if not exists public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.recently_viewed (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  guest_id    text,
  product_id  uuid not null references public.products(id) on delete cascade,
  viewed_at   timestamptz not null default now()
);

create index if not exists recently_viewed_user_idx on public.recently_viewed (user_id, viewed_at desc);
create index if not exists recently_viewed_guest_idx on public.recently_viewed (guest_id, viewed_at desc);

-- ---------------------------------------------------------------------------
-- Orders, payments
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  user_id           uuid not null references public.profiles(id) on delete restrict,
  status            text not null default 'Order Placed'
                    check (status in ('Order Placed','Payment Confirmed','Processing','Packed','Shipped',
                                      'Out for Delivery','Delivered','Cancelled','Return Requested','Refunded')),
  payment_method    text not null default 'razorpay' check (payment_method in ('razorpay','cod')),
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending','paid','failed','cancelled','refunded')),
  subtotal          numeric(12,2) not null default 0 check (subtotal >= 0),
  discount          numeric(12,2) not null default 0 check (discount >= 0),
  shipping          numeric(12,2) not null default 0 check (shipping >= 0),
  total             numeric(12,2) not null default 0 check (total >= 0),
  savings           numeric(12,2) not null default 0,
  coupon_code       text,
  currency          text not null default 'INR',
  address           jsonb not null default '{}'::jsonb,
  delivery_notes    text,
  timeline          jsonb not null default '[]'::jsonb,
  idempotency_key   text,
  cancel_reason     text,
  return_reason     text,
  placed_at         timestamptz not null default now(),
  delivered_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_number_idx on public.orders (order_number);

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  name          text not null,
  slug          text,
  image_url     text,
  size          text,
  color         text,
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  mrp           numeric(12,2) not null default 0,
  qty           integer not null check (qty > 0),
  line_total    numeric(12,2) not null check (line_total >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.payments (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders(id) on delete cascade,
  user_id                uuid not null references public.profiles(id) on delete restrict,
  provider               text not null default 'razorpay',
  razorpay_order_id      text,
  razorpay_payment_id    text,
  razorpay_signature     text,
  amount                 numeric(12,2) not null default 0,
  currency               text not null default 'INR',
  status                 text not null default 'created'
                         check (status in ('created','authorized','captured','failed','refunded','cancelled')),
  failure_reason         text,
  verified_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- One payment record per gateway payment id: duplicate callbacks cannot double-process.
create unique index if not exists payments_razorpay_payment_idx
  on public.payments (razorpay_payment_id) where razorpay_payment_id is not null;
create index if not exists payments_order_idx on public.payments (order_id);

-- ---------------------------------------------------------------------------
-- Coupons and promotions
-- ---------------------------------------------------------------------------

create table if not exists public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  description     text,
  type            text not null default 'percent' check (type in ('percent','flat','free_shipping')),
  value           numeric(12,2) not null default 0 check (value >= 0),
  min_order       numeric(12,2) not null default 0,
  max_discount    numeric(12,2),
  usage_limit     integer,
  per_user_limit  integer not null default 1,
  used_count      integer not null default 0,
  campaign        text,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  is_active       boolean not null default true,
  first_order_only boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.coupon_usage (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  discount    numeric(12,2) not null default 0,
  used_at     timestamptz not null default now()
);

create index if not exists coupon_usage_user_idx on public.coupon_usage (user_id, coupon_id);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create table if not exists public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  rating      integer not null check (rating between 1 and 5),
  title       text,
  body        text,
  is_approved boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists product_reviews_product_idx on public.product_reviews (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Content: blog, vlog, FAQs, newsletter, support
-- ---------------------------------------------------------------------------

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  excerpt       text,
  body          text,
  cover_url     text,
  author        text,
  category      text,
  tags          text[] default '{}',
  read_minutes  integer default 4,
  is_published  boolean not null default true,
  published_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.vlog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  description   text,
  youtube_id    text not null,
  thumbnail_url text,
  duration      text,
  is_published  boolean not null default true,
  published_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  topic       text default 'General',
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  user_id     uuid references public.profiles(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null,
  email       text not null,
  subject     text not null,
  message     text not null,
  order_number text,
  status      text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  replies     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status);

-- ---------------------------------------------------------------------------
-- Store settings (single row) and admin audit trail
-- ---------------------------------------------------------------------------

create table if not exists public.store_settings (
  id             integer primary key default 1 check (id = 1),
  brand_name     text not null default 'ZYREX STORE',
  tagline        text,
  support_email  text,
  support_phone  text,
  address        text,
  announcement   text,
  currency       text not null default 'INR',
  free_shipping_threshold numeric(12,2) not null default 999,
  shipping_fee   numeric(12,2) not null default 49,
  cod_enabled    boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table if not exists public.admin_roles (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  granted_by  uuid references public.profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  note        text
);

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

alter table public.profiles              enable row level security;
alter table public.user_addresses        enable row level security;
alter table public.categories            enable row level security;
alter table public.subcategories         enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_variants      enable row level security;
alter table public.inventory             enable row level security;
alter table public.carts                 enable row level security;
alter table public.cart_items            enable row level security;
alter table public.wishlists             enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.recently_viewed       enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.payments              enable row level security;
alter table public.coupons               enable row level security;
alter table public.coupon_usage          enable row level security;
alter table public.product_reviews       enable row level security;
alter table public.blog_posts            enable row level security;
alter table public.vlog_posts            enable row level security;
alter table public.faqs                  enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.support_tickets       enable row level security;
alter table public.store_settings        enable row level security;
alter table public.admin_roles           enable row level security;

-- Profiles: own row only; admins read all.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- A customer must not be able to promote themselves.
create or replace function public.prevent_self_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Only administrators may change roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.prevent_self_promotion();

-- Addresses: owner only.
drop policy if exists addresses_owner on public.user_addresses;
create policy addresses_owner on public.user_addresses
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Catalogue: public read, admin write.
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists subcategories_public_read on public.subcategories;
create policy subcategories_public_read on public.subcategories for select using (true);
drop policy if exists subcategories_admin_write on public.subcategories;
create policy subcategories_admin_write on public.subcategories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (is_active or public.is_admin());
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read on public.product_images for select using (true);
drop policy if exists product_images_admin_write on public.product_images;
create policy product_images_admin_write on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read on public.product_variants for select using (true);
drop policy if exists product_variants_admin_write on public.product_variants;
create policy product_variants_admin_write on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists inventory_public_read on public.inventory;
create policy inventory_public_read on public.inventory for select using (true);
drop policy if exists inventory_admin_write on public.inventory;
create policy inventory_admin_write on public.inventory
  for all using (public.is_admin()) with check (public.is_admin());

-- Cart / wishlist / recently viewed: owner only.
drop policy if exists carts_owner on public.carts;
create policy carts_owner on public.carts
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists cart_items_owner on public.cart_items;
create policy cart_items_owner on public.cart_items
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists wishlists_owner on public.wishlists;
create policy wishlists_owner on public.wishlists
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists wishlist_items_owner on public.wishlist_items;
create policy wishlist_items_owner on public.wishlist_items
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists recently_viewed_owner on public.recently_viewed;
create policy recently_viewed_owner on public.recently_viewed
  for all using (user_id = auth.uid() or guest_id is not null or public.is_admin())
  with check (user_id = auth.uid() or guest_id is not null or public.is_admin());

-- Orders: customers see only their own; only admins may change status.
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists orders_owner_insert on public.orders;
create policy orders_owner_insert on public.orders
  for insert with check (user_id = auth.uid());

drop policy if exists orders_owner_update on public.orders;
create policy orders_owner_update on public.orders
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (
    exists (select 1 from public.orders o
            where o.id = order_items.order_id
              and (o.user_id = auth.uid() or public.is_admin()))
  );

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (
    exists (select 1 from public.orders o
            where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- Payments: owner reads; writes come from the server (service role) only.
drop policy if exists payments_owner_read on public.payments;
create policy payments_owner_read on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

-- Coupons: public may read active codes (needed for validation UX), admins manage.
drop policy if exists coupons_read_active on public.coupons;
create policy coupons_read_active on public.coupons
  for select using (is_active or public.is_admin());
drop policy if exists coupons_admin_write on public.coupons;
create policy coupons_admin_write on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists coupon_usage_owner on public.coupon_usage;
create policy coupon_usage_owner on public.coupon_usage
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists coupon_usage_insert on public.coupon_usage;
create policy coupon_usage_insert on public.coupon_usage
  for insert with check (user_id = auth.uid());

-- Reviews: readable by all, writable by the author only.
drop policy if exists reviews_read on public.product_reviews;
create policy reviews_read on public.product_reviews
  for select using (is_approved or user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_insert_own on public.product_reviews;
create policy reviews_insert_own on public.product_reviews
  for insert with check (user_id = auth.uid());
drop policy if exists reviews_update_own on public.product_reviews;
create policy reviews_update_own on public.product_reviews
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_delete on public.product_reviews;
create policy reviews_delete on public.product_reviews
  for delete using (user_id = auth.uid() or public.is_admin());

-- Content: published content is public, admins manage.
drop policy if exists blog_public_read on public.blog_posts;
create policy blog_public_read on public.blog_posts
  for select using (is_published or public.is_admin());
drop policy if exists blog_admin_write on public.blog_posts;
create policy blog_admin_write on public.blog_posts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists vlog_public_read on public.vlog_posts;
create policy vlog_public_read on public.vlog_posts
  for select using (is_published or public.is_admin());
drop policy if exists vlog_admin_write on public.vlog_posts;
create policy vlog_admin_write on public.vlog_posts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists faqs_public_read on public.faqs;
create policy faqs_public_read on public.faqs for select using (is_active or public.is_admin());
drop policy if exists faqs_admin_write on public.faqs;
create policy faqs_admin_write on public.faqs
  for all using (public.is_admin()) with check (public.is_admin());

-- Newsletter: anyone may subscribe; only admins may list.
drop policy if exists newsletter_insert on public.newsletter_subscribers;
create policy newsletter_insert on public.newsletter_subscribers
  for insert with check (true);
drop policy if exists newsletter_admin_read on public.newsletter_subscribers;
create policy newsletter_admin_read on public.newsletter_subscribers
  for select using (public.is_admin());

-- Support: anyone may open a ticket; owners and admins may read/update.
drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets for insert with check (true);
drop policy if exists tickets_read on public.support_tickets;
create policy tickets_read on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists tickets_admin_update on public.support_tickets;
create policy tickets_admin_update on public.support_tickets
  for update using (public.is_admin()) with check (public.is_admin());

-- Settings: public read, admin write.
drop policy if exists settings_public_read on public.store_settings;
create policy settings_public_read on public.store_settings for select using (true);
drop policy if exists settings_admin_write on public.store_settings;
create policy settings_admin_write on public.store_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Admin roles: admins only.
drop policy if exists admin_roles_admin on public.admin_roles;
create policy admin_roles_admin on public.admin_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Default settings row
-- ===========================================================================

insert into public.store_settings (id, brand_name, tagline, support_email, support_phone, announcement)
values (1, 'ZYREX STORE', 'Everything you need, in one place',
        'support@zyrexstore.com', '+91 90000 00000',
        'Free delivery on orders above ₹999 · Easy 7-day returns')
on conflict (id) do nothing;

-- Promote the first administrator AFTER creating the account in Auth:
--   update public.profiles set role = 'admin' where email = 'admin@zyrexstore.com';
