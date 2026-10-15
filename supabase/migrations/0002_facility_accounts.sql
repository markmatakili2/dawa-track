create type verification_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table public.facility_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  facility_name text not null,
  facility_type text not null check (facility_type in
    ('hospital','health_centre','clinic','pharmacy','warehouse','other')),
  county text not null,
  address text,
  licence_number text not null,
  contact_person text not null,
  contact_role text,
  phone text not null,
  email text not null,
  verification_status verification_status not null default 'pending',
  verification_notes text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index facility_profiles_licence_idx on public.facility_profiles (lower(licence_number));
create index facility_profiles_status_idx on public.facility_profiles (verification_status);

create trigger facility_profiles_set_updated_at
before update on public.facility_profiles
for each row execute function public.set_updated_at();

-- Record who changed the verification status and when
create or replace function public.facility_profiles_track_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status then
    new.verified_at := now();
    new.verified_by := auth.uid();
  end if;
  return new;
end $$;
create trigger facility_profiles_track_verification_trg
before update on public.facility_profiles
for each row execute function public.facility_profiles_track_verification();

-- Create the profile automatically at signup from the metadata the signup form sends.
-- (Works even when email confirmation is on and the client has no session yet.)
-- Users created without facility metadata (e.g. admins created in the dashboard) are skipped.
create or replace function public.handle_new_facility_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(m->>'facility_name','') = '' then
    return new;
  end if;
  insert into public.facility_profiles
    (user_id, facility_name, facility_type, county, address, licence_number,
     contact_person, contact_role, phone, email)
  values
    (new.id, left(m->>'facility_name',200),
     coalesce(nullif(m->>'facility_type',''),'other'),
     left(m->>'county',100), left(m->>'address',300), left(m->>'licence_number',100),
     left(m->>'contact_person',150), left(m->>'contact_role',100),
     left(m->>'phone',30), new.email);
  return new;
end $$;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_facility_signup();

create or replace function public.is_verified_facility()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.facility_profiles
                 where user_id = auth.uid() and verification_status = 'approved');
$$;

create or replace function public.can_view_listings()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.facility_profiles
                 where user_id = auth.uid() and verification_status in ('pending','approved'));
$$;

-- facility_profiles RLS: users read only their own row; only admins read all / change status
alter table public.facility_profiles enable row level security;
create policy "fp_own_read" on public.facility_profiles
  for select to authenticated using (user_id = auth.uid());
create policy "fp_admin_read" on public.facility_profiles
  for select to authenticated using (public.is_admin());
create policy "fp_admin_update" on public.facility_profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "fp_admin_delete" on public.facility_profiles
  for delete to authenticated using (public.is_admin());

-- The old admin-managed facilities registry is replaced by facility_profiles
drop table public.facilities;

-- ---------- medicines ----------
alter table public.medicines
  add column listed_by uuid references auth.users(id) on delete set null;

drop policy "medicines_public_read_approved" on public.medicines;
drop policy "medicines_public_submit_pending" on public.medicines;

create policy "medicines_member_read" on public.medicines
  for select to authenticated
  using (approval = 'approved' and expiry_date >= current_date and public.can_view_listings());
create policy "medicines_owner_read" on public.medicines
  for select to authenticated using (listed_by = auth.uid());
create policy "medicines_admin_read" on public.medicines
  for select to authenticated using (public.is_admin());
create policy "medicines_verified_insert" on public.medicines
  for insert to authenticated
  with check (public.is_admin()
              or (public.is_verified_facility() and approval = 'pending' and listed_by = auth.uid()));
create policy "medicines_owner_withdraw" on public.medicines
  for delete to authenticated using (listed_by = auth.uid() and approval = 'pending');
-- existing medicines_admin_update / medicines_admin_delete policies remain

-- Never trust client-supplied ownership, approval or facility identity
create or replace function public.medicines_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.facility_profiles%rowtype;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  select * into p from public.facility_profiles where user_id = auth.uid();
  new.approval := 'pending';
  new.listed_by := auth.uid();
  if found then
    new.facility_name := p.facility_name;
    new.contact_person := coalesce(nullif(new.contact_person,''), p.contact_person);
    new.phone := coalesce(nullif(new.phone,''), p.phone);
    new.email := coalesce(nullif(new.email,''), p.email);
  end if;
  return new;
end $$;
create trigger medicines_before_insert_trg
before insert on public.medicines
for each row execute function public.medicines_before_insert();

-- ---------- transfer_requests ----------
alter table public.transfer_requests
  add column requested_by uuid references auth.users(id) on delete set null;

drop policy "transfer_requests_public_submit" on public.transfer_requests;

create policy "transfer_requests_verified_insert" on public.transfer_requests
  for insert to authenticated
  with check (public.is_verified_facility() and requested_by = auth.uid());
create policy "transfer_requests_owner_read" on public.transfer_requests
  for select to authenticated using (requested_by = auth.uid());
-- existing admin read/update/delete policies remain

create or replace function public.transfer_requests_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.facility_profiles%rowtype; m public.medicines%rowtype;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  select * into p from public.facility_profiles where user_id = auth.uid();
  if not found then raise exception 'Facility profile required.'; end if;
  select * into m from public.medicines where id = new.medicine_id;
  if not found or m.approval <> 'approved' or m.expiry_date < current_date then
    raise exception 'This listing is not available.';
  end if;
  if m.listed_by = auth.uid() then
    raise exception 'You cannot request your own listing.';
  end if;
  new.requested_by := auth.uid();
  new.drug_name := m.drug_name;
  new.supplier_facility_name := m.facility_name;
  new.requesting_facility := p.facility_name;
  new.contact_person := coalesce(nullif(new.contact_person,''), p.contact_person);
  new.phone := coalesce(nullif(new.phone,''), p.phone);
  new.email := coalesce(nullif(new.email,''), p.email);
  new.delivery_location := coalesce(nullif(new.delivery_location,''), p.address, p.county);
  return new;
end $$;
create trigger transfer_requests_before_insert_trg
before insert on public.transfer_requests
for each row execute function public.transfer_requests_before_insert();

-- ---------- limited public preview for the landing page (no facility, quantity or contacts) ----------
create or replace function public.preview_medicines(max_rows int default 3)
returns table (drug_name text, unit text, expiry_window text)
language sql security definer stable set search_path = public as $$
  select m.drug_name, m.unit,
    case when m.expiry_date - current_date <= 30 then 'Under 1 month'
         when m.expiry_date - current_date <= 90 then '1 to 3 months'
         else 'Over 3 months' end
  from public.medicines m
  where m.approval = 'approved' and m.expiry_date >= current_date
  order by m.submitted_at desc
  limit least(greatest(max_rows, 1), 5);
$$;

create or replace function public.listing_stats()
returns table (listings bigint, facilities bigint)
language sql security definer stable set search_path = public as $$
  select
    (select count(*) from public.medicines where approval = 'approved' and expiry_date >= current_date),
    (select count(*) from public.facility_profiles where verification_status = 'approved');
$$;

revoke all on function public.preview_medicines(int) from public;
revoke all on function public.listing_stats() from public;
grant execute on function public.preview_medicines(int) to anon, authenticated;
grant execute on function public.listing_stats() to anon, authenticated;
