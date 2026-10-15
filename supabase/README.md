# Supabase setup for Dawa Track

Dawa Track is a static frontend backed by Supabase Postgres and Auth. Database security is enforced with row-level security and triggers; frontend restrictions are only a usability layer.

## Run the migrations

Apply the SQL manually and in order:

1. Open the Supabase project and go to **SQL Editor**.
2. Paste and run [`migrations/0001_init.sql`](./migrations/0001_init.sql).
3. Paste and run [`migrations/0002_facility_accounts.sql`](./migrations/0002_facility_accounts.sql).

The migrations are not run automatically by the static site. Migration 0002 replaces the public facility registry with Auth-linked facility profiles, adds verification and ownership tracking, and restricts listings and transfer requests through RLS.

## Configure Supabase Auth

In **Authentication → URL Configuration**:

- Keep **Confirm email** enabled.
- Set **Site URL** to the deployed Vercel site origin, for example `https://your-project.vercel.app`.
- Add the deployed origin plus the local development origin to **Redirect URLs**, for example:
  - `https://your-project.vercel.app/**`
  - `http://localhost:5500/**`
  - `http://127.0.0.1:5500/**`

The signup flow sends confirmation links to `/login.html`. Use the actual local server origin and port in the redirect allowlist when developing locally.

## Facility signup and verification

Facilities create accounts through **Create account** on `login.html`. The signup sends facility and contact details as Auth user metadata. A database trigger creates a linked `facility_profiles` row with `pending` verification status, including when email confirmation is required and the new user has no active session yet.

Pending facilities can sign in and browse approved, unexpired listings. Only approved facilities can submit transfer requests or add medicine listings. Rejected and suspended profiles cannot browse listings. These rules are enforced in the database; hiding or disabling interface controls does not grant access.

An administrator reviews facility profiles in the admin dashboard. Approval, rejection, and suspension are recorded with the administrator UID and timestamp. Rejected or suspended facilities can be reactivated by an administrator.

## Create an administrator

1. In Supabase, open **Authentication → Users** and create the administrator account. Do not include facility signup metadata.
2. Copy the account UID.
3. Run this statement in the SQL Editor, replacing `<uid>` with the actual UID:

```sql
insert into public.admins (user_id) values ('<uid>');
```

Admin membership is managed manually in the SQL Editor; client access to the `admins` table remains disabled. Administrators use `admin-login.html`.
