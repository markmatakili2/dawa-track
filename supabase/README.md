# Supabase setup for Dawa Track

This project is a static frontend that talks to Supabase for authentication, facility data, medicine listings, and transfer requests. The app does not run its own server, so the database must be created manually in Supabase.

## What the migration does

The file [supabase/migrations/0001_init.sql](./migrations/0001_init.sql) creates the database tables, enum values, row-level security policies, indexes, and the admin helper functions the frontend relies on.

It sets up:

- `public.facilities` for facility registry data
- `public.medicines` for approved and pending stock listings
- `public.transfer_requests` for medicine requests from the public browse page
- `public.admins` for the admin authorization list
- RLS rules so anonymous users can submit listings and requests, while only admins can approve or manage sensitive records

## Run the migration manually

1. Open your Supabase project.
2. Go to the SQL Editor.
3. Paste the contents of [supabase/migrations/0001_init.sql](./migrations/0001_init.sql).
4. Run the script.

This repository does not auto-apply the migration.

## Create an admin user

1. In Supabase, go to Authentication → Users.
2. Add a user.
3. Copy the new user UID.
4. Run the following in the SQL Editor:

```sql
insert into public.admins (user_id) values ('<uid>');
```

Once the UID is added to `public.admins`, the user can sign in to the admin dashboard.
