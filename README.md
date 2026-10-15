# Dawa Track

Dawa Track helps licensed facilities coordinate medicine transfers before stock expires. Facility accounts are verified by an administrator before they can list or request medicine.

## Local development

1. Copy `config.example.js` to `config.js`.
2. Fill in your Supabase project URL and anon key.
3. Set `window.DAWA_TURNSTILE_SITE_KEY` to your Cloudflare Turnstile site key (leave it empty to see the setup warning; auth forms remain unavailable).
4. Serve the directory locally (for example, with VS Code Live Server) so the Auth redirect uses a stable local origin.

## Account and approval flow

Facilities sign up from `login.html` and confirm their email. New accounts are pending verification and can browse approved, unexpired listings. An administrator approves a facility before it can request stock or list surplus medicine. Administrators review accounts and manage listings and transfer requests from the admin dashboard.

Database row-level security and triggers enforce account ownership, facility verification, listing approval, and transfer-request restrictions. UI controls do not replace these database checks.

## Supabase setup

Run `supabase/migrations/0001_init.sql` and then `supabase/migrations/0002_facility_accounts.sql` manually in the Supabase SQL Editor. In Supabase **Authentication → URL Configuration**, keep **Confirm email** on, set the **Site URL** to the Vercel origin, and allow the production domain and local development URL under **Redirect URLs**. See [`supabase/README.md`](./supabase/README.md) for full setup and administrator creation instructions.

## Production deployment

This project is designed for Vercel as a static site:

- Connect the GitHub repository to a Vercel project.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Vercel project settings.
- Set `TURNSTILE_SITE_KEY` to the Cloudflare Turnstile **site key** for the deployed hostname. The build writes it to the public `config.js`; it is intended to be public.
- Vercel runs `npm run build` to generate `config.js` from those environment variables.

The generated `config.js` is loaded by the static pages to connect to Supabase.

## Turnstile CAPTCHA

1. In the Cloudflare dashboard, create a Turnstile widget and allow the production domain and local development hostname (usually `localhost`).
2. Set the widget's **site key** as `TURNSTILE_SITE_KEY` in Vercel. For local development, set `window.DAWA_TURNSTILE_SITE_KEY` in your local `config.js`; `config.example.js` leaves it empty, which displays a configuration warning and disables auth submissions.
3. In the Supabase dashboard, open **Authentication → Bot and Abuse Protection**, enable CAPTCHA protection for sign-up, password sign-in, and password reset, and choose **Cloudflare Turnstile**. Enter the corresponding Turnstile **secret key** there.

The secret key belongs only in the Supabase dashboard. Never add it to the repository, Vercel's public build output, or `config.js`. Each sign-in, sign-up, and password-reset form obtains a one-use token from its own Turnstile widget and sends it to Supabase Auth.
