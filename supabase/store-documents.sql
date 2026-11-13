-- ZYREX STORE — Supabase document mirror.
--
-- The API server keeps an in-memory document model and mirrors every mutation
-- here, so catalogue, accounts, carts and orders survive a redeploy instead of
-- being rebuilt from seed data.
--
-- Apply this file in the Supabase SQL editor (or ask AppJet to run it) once the
-- Supabase integration is authorised.
--
-- Security: RLS is enabled with no policies for `anon` or `authenticated`, so the
-- public keys cannot read or write this table. Only the service-role key — held
-- server-side in SUPABASE_SERVICE_ROLE_KEY — can access it.

create table if not exists public.store_documents (
  collection text        not null,
  id         uuid        not null,
  payload    jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists store_documents_collection_idx
  on public.store_documents (collection);

alter table public.store_documents enable row level security;

-- Intentionally no policies: service role only.

comment on table public.store_documents is
  'Document mirror for the ZYREX STORE API server. Service-role access only.';
