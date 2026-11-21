-- TrekkSewa backend schema for Supabase (PostgreSQL).
--
-- The website is static, so the browser talks to the database directly with the public
-- "anon" key. Everything that key is allowed to do is decided by the row-level-security
-- policies below:
--
--   * anyone may SUBMIT a partner application, a gear listing or a trail report
--   * anyone may READ partners, gear and reports that an admin has published
--   * nobody can read applications or unpublished rows with the anon key
--
-- Review and publishing happen in the Supabase dashboard (or a future admin screen) using
-- an authenticated admin, never from the public site.
--
-- To switch the site on: run this file once in the SQL editor, then put the project URL and
-- anon key into site.config.json ("backend") and rebuild.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ applications (private)

create table if not exists public.partner_applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  role        text not null check (role in ('guide', 'porter', 'agency', 'gear', 'other')),
  name        text not null check (char_length(name) between 2 and 120),
  phone       text not null check (phone ~ '^[0-9+ ()-]{6,30}$'),
  email       text check (email is null or (char_length(email) <= 160 and email like '%_@_%')),
  district    text check (district is null or char_length(district) <= 60),
  details     jsonb not null default '{}'::jsonb check (pg_column_size(details) < 8192),
  consent     boolean not null check (consent),
  source      text check (source is null or char_length(source) <= 80),
  -- set by admins only
  status      text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected')),
  admin_notes text
);

comment on table public.partner_applications is 'Raw applications from the public partner form. Never readable with the anon key.';

alter table public.partner_applications enable row level security;

drop policy if exists "public can apply" on public.partner_applications;
create policy "public can apply" on public.partner_applications
  for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null);

-- No select, update or delete policy: the anon key can write a new row and nothing else.

create index if not exists partner_applications_status_idx on public.partner_applications (status, created_at desc);

-- ------------------------------------------------------------------ partners (published profiles)

create table if not exists public.partners (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  application_id uuid references public.partner_applications (id) on delete set null,
  role          text not null check (role in ('guide', 'porter', 'agency', 'gear', 'other')),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null,
  tagline       text,
  about         text,
  base          text,                       -- where they work from
  regions       text[] not null default '{}', -- region slugs from the site
  treks         text[] not null default '{}', -- trek slugs from the site
  languages     text[] not null default '{}',
  years         integer check (years is null or years between 0 and 70),
  -- credentials shown publicly so trekkers can check them
  licence_no    text,                       -- guide licence / tourism licence
  registration  jsonb not null default '{}'::jsonb, -- agency: company reg, PAN, TAAN
  verified_at   timestamptz,                -- when TrekkSewa last checked the credentials
  daily_rate_npr integer check (daily_rate_npr is null or daily_rate_npr between 0 and 200000),
  rate_includes text,
  -- contact, shown only when the partner has agreed
  phone_public  text,
  whatsapp      text,
  email_public  text,
  website       text,
  photo_url     text,
  accepted_standards boolean not null default false,
  featured      boolean not null default false,
  published     boolean not null default false
);

alter table public.partners enable row level security;

drop policy if exists "public reads published partners" on public.partners;
create policy "public reads published partners" on public.partners
  for select to anon, authenticated
  using (published);

create index if not exists partners_role_idx on public.partners (role) where published;
create index if not exists partners_regions_idx on public.partners using gin (regions);

-- The site reads this view, so private columns never leave the database even by accident.
create or replace view public.partners_public
with (security_invoker = true) as
  select id, role, slug, name, tagline, about, base, regions, treks, languages, years,
         licence_no, registration, verified_at, daily_rate_npr, rate_includes,
         phone_public, whatsapp, email_public, website, photo_url,
         accepted_standards, featured
  from public.partners
  where published;

-- ------------------------------------------------------------------ gear listings

create table if not exists public.gear_listings (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  partner_id  uuid not null references public.partners (id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 140),
  category    text not null,               -- category id from content/gear.json
  mode        text not null check (mode in ('rent', 'buy')),
  price_npr   integer not null check (price_npr between 0 and 5000000),
  unit        text,                         -- "per day" for rentals
  place       text,
  details     text check (details is null or char_length(details) <= 1200),
  photo_url   text,
  published   boolean not null default false
);

alter table public.gear_listings enable row level security;

drop policy if exists "public reads published gear" on public.gear_listings;
create policy "public reads published gear" on public.gear_listings
  for select to anon, authenticated
  using (published);

-- ------------------------------------------------------------------ trail reports

create table if not exists public.trail_reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  observed_on date not null check (observed_on <= current_date and observed_on > current_date - 30),
  place       text not null check (char_length(place) between 2 and 80), -- place slug or free text
  trek        text check (trek is null or char_length(trek) <= 80),
  kind        text not null check (kind in ('trail', 'road', 'flight', 'pass', 'bridge', 'lodge', 'weather', 'other')),
  status      text not null check (status in ('open', 'caution', 'closed', 'info')),
  summary     text not null check (char_length(summary) between 10 and 600),
  reporter    text check (reporter is null or char_length(reporter) <= 80),
  partner_id  uuid references public.partners (id) on delete set null,
  published   boolean not null default false
);

alter table public.trail_reports enable row level security;

drop policy if exists "public can report" on public.trail_reports;
create policy "public can report" on public.trail_reports
  for insert to anon, authenticated
  with check (published = false and partner_id is null);

drop policy if exists "public reads published reports" on public.trail_reports;
create policy "public reads published reports" on public.trail_reports
  for select to anon, authenticated
  using (published and observed_on > current_date - 21);

create index if not exists trail_reports_recent_idx on public.trail_reports (observed_on desc) where published;

-- ------------------------------------------------------------------ housekeeping

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists partners_touch on public.partners;
create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();
