# ClassForge

Build a better college schedule. ClassForge is a Next.js app for planning a college class schedule: pick courses, block out work and life time, and let the scheduler find conflict-free combinations. Accounts, saved schedules and degree progress use Supabase.

## Stack

- Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS 4
- Supabase (auth, Postgres with Row Level Security)
- Node's built-in test runner (`node --test`)

## Setup

Requirements: Node.js 20 or newer and a Supabase project (the free tier works).

```bash
npm ci
cp .env.example .env.local   # then fill in your own values
npm run dev                  # http://localhost:3000
```

Environment variables (all names are listed with placeholder values in `.env.example`; never commit real values):

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Browser-safe Supabase key |
| `NEXT_PUBLIC_SITE_URL` / `SITE_URL` | in production | Canonical origin for metadata, robots and sitemap |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | recommended | Contact address shown on contact, privacy and terms pages |
| `NEXT_PUBLIC_GA_ID` | no | Google Analytics 4 ID; analytics are off when empty |
| `GEMINI_API_KEY` | no | Server-only key for the `/api/chat` assistant |
| `POS_OWNER_EMAILS` | no | Comma-separated emails allowed into the Agent Lab; empty means nobody |

Database: apply the SQL files in `supabase/migrations/` to your project (for example with the Supabase CLI, `supabase db push`). They create the tables and Row Level Security policies the app expects.

If no site URL is set, the app uses `VERCEL_PROJECT_PRODUCTION_URL` in Vercel production, then `VERCEL_URL`, then `http://localhost:3000`.

## Scripts

```bash
npm test         # unit tests
npm run lint     # ESLint
npm run build    # production build (needs the Supabase variables set)
npm start        # serve the production build
```

## Deploying

Any Node host that runs Next.js works. On Vercel, import the repo, set the variables above in the project settings, and deploy. Keep `NEXT_PUBLIC_SITE_URL` aligned with your domain. Private routes are marked `noindex`; public pages are crawlable.

## Brand

The ClassForge name, logo and assets in `public/brand/` identify the original project. If you run your own public instance, please use your own name and branding. Brand settings live in `src/lib/brand.js`.

## Contributing and license

See `CONTRIBUTING.md`. Released under the MIT License, see `LICENSE`.
