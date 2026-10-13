# Dawa Track

Dawa Track is a static medicines-sharing and surplus-stock coordination site for facilities. It lets facilities browse approved stock, submit surplus listings, and request medicine transfers between institutions without needing a complex backend.

## Local development

1. Copy `config.example.js` to `config.js`.
2. Fill in your own Supabase project URL and anon key.
3. Open `index.html` in a browser. No local server is required.

## Supabase migration

This repo includes the SQL migration at `supabase/migrations/0001_init.sql`. It must be applied manually in the Supabase SQL Editor because the project is a static frontend and does not auto-run database migrations.

## Production deployment

This project is designed for Vercel deployment as a static site:

- Connect the GitHub repo to a Vercel project.
- Set the environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Vercel project settings.
- Vercel runs `npm run build` automatically, which creates `config.js` from those environment variables.
- The generated `config.js` is then loaded by the static pages so they can talk to Supabase.
