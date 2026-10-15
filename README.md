# Dawa Track

Dawa Track helps licensed facilities coordinate medicine transfers before stock expires. Facility accounts are verified by an administrator before they can list or request medicine.

## Local development

1. Copy `config.example.js` to `config.js`.
2. Fill in your Supabase project URL and anon key.
3. Serve the directory locally (for example, with VS Code Live Server) so the Auth redirect uses a stable local origin.

## Account and approval flow

Facilities sign up from `login.html` and confirm their email. New accounts are pending verification and can browse approved, unexpired listings. An administrator approves a facility before it can request stock or list surplus medicine. Administrators review accounts and manage listings and transfer requests from the admin dashboard.

Database row-level security and triggers enforce account ownership, facility verification, listing approval, and transfer-request restrictions. UI controls do not replace these database checks.

## Supabase setup

Run `supabase/migrations/0001_init.sql` and then `supabase/migrations/0002_facility_accounts.sql` manually in the Supabase SQL Editor. In Supabase **Authentication → URL Configuration**, keep **Confirm email** on, set the **Site URL** to the Vercel origin, and allow the production domain and local development URL under **Redirect URLs**. See [`supabase/README.md`](./supabase/README.md) for full setup and administrator creation instructions.

## Production deployment

This project is designed for Vercel as a static site:

- Connect the GitHub repository to a Vercel project.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Vercel project settings.
- Vercel runs `npm run build` to generate `config.js` from those environment variables.

The generated `config.js` is loaded by the static pages to connect to Supabase.
