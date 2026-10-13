-- Enable required extension
create extension if not exists pgcrypto;

-- Enum types
create type approval_status as enum ('pending', 'approved', 'rejected');
create type medicine_status as enum ('ready', 'monitor');
create type request_status as enum ('new', 'contacted', 'resolved');

-- Facilities (admin-managed registry)
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text,
  contact_person text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- Medicines (public listings, pending admin approval before they appear on the browse page)
create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  drug_name text not null,
  quantity integer not null check (quantity > 0),
  unit text not null default 'units',
  facility_name text not null,
  expiry_date date not null,
  status medicine_status not null default 'monitor',
  approval approval_status not null default 'pending',
  storage_condition text,
  contact_person text,
  phone text,
  email text,
  location text,
  notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transfer requests (submitted via the public "Request medicine" modal on index.html)
create table public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  drug_name text not null,
  supplier_facility_name text not null,
  requesting_facility text not null,
  delivery_location text not null,
  contact_person text not null,
  phone text not null,
  email text not null,
  details text,
  status request_status not null default 'new',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin registry — membership here (NOT just "is authenticated") is what grants admin rights
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger medicines_set_updated_at
before update on public.medicines
for each row execute function public.set_updated_at();

create trigger transfer_requests_set_updated_at
before update on public.transfer_requests
for each row execute function public.set_updated_at();

create index medicines_approval_idx on public.medicines (approval);
create index medicines_expiry_idx on public.medicines (expiry_date);
create index transfer_requests_status_idx on public.transfer_requests (status);
create index transfer_requests_medicine_idx on public.transfer_requests (medicine_id);

alter table public.facilities enable row level security;
alter table public.medicines enable row level security;
alter table public.transfer_requests enable row level security;
alter table public.admins enable row level security;

create policy "facilities_public_read" on public.facilities
  for select to anon, authenticated using (true);
create policy "facilities_admin_insert" on public.facilities
  for insert to authenticated with check (public.is_admin());
create policy "facilities_admin_update" on public.facilities
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "facilities_admin_delete" on public.facilities
  for delete to authenticated using (public.is_admin());

create policy "medicines_public_read_approved" on public.medicines
  for select to anon, authenticated using (approval = 'approved' or public.is_admin());
create policy "medicines_public_submit_pending" on public.medicines
  for insert to anon, authenticated with check (approval = 'pending' or public.is_admin());
create policy "medicines_admin_update" on public.medicines
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "medicines_admin_delete" on public.medicines
  for delete to authenticated using (public.is_admin());

create policy "transfer_requests_public_submit" on public.transfer_requests
  for insert to anon, authenticated with check (true);
create policy "transfer_requests_admin_read" on public.transfer_requests
  for select to authenticated using (public.is_admin());
create policy "transfer_requests_admin_update" on public.transfer_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "transfer_requests_admin_delete" on public.transfer_requests
  for delete to authenticated using (public.is_admin());

-- admins table intentionally has NO client-facing policies: RLS is enabled with zero policies,
-- so neither anon nor authenticated clients can read/write it at all. It's only managed by hand
-- through the Supabase SQL editor.

-- Optional demo seed data so the browse page isn't empty on first deploy. Safe to remove later.
insert into public.facilities (name, county, contact_person, phone, email) values
  ('Kenyatta National Hospital', 'Nairobi', 'Pharmacy Lead', '0711000001', 'contact@knh.go.ke'),
  ('Machakos Level 5', 'Machakos', 'Supply Officer', '0711000002', 'contact@machakoslevel5.go.ke'),
  ('KEMSA Central Warehouse', 'Nairobi', 'Warehouse Manager', '0711000003', 'contact@kemsa.go.ke');

insert into public.medicines (drug_name, quantity, unit, facility_name, expiry_date, status, approval) values
  ('Amoxicillin 500mg', 4000, 'units', 'Kenyatta National Hospital', current_date + 3, 'ready', 'approved'),
  ('Paracetamol Infusion', 2500, 'units', 'Machakos Level 5', current_date + 9, 'ready', 'approved'),
  ('ORS Sachets', 10000, 'units', 'Machakos Level 5', current_date + 60, 'monitor', 'approved'),
  ('IV Normal Saline', 15000, 'units', 'KEMSA Central Warehouse', current_date + 21, 'ready', 'approved'),
  ('Ceftriaxone 1g Injection', 1200, 'vials', 'Kenyatta National Hospital', current_date + 14, 'ready', 'approved');
