# ClassForge

**Build your college class schedule in minutes instead of hours.**

Picking classes each semester means juggling course sections, work shifts, practice, commutes and degree requirements, usually inside a slow university portal that only shows one term. ClassForge does the juggling for you: you tell it which courses you need and when you are busy, and it shows every schedule that fits with no time conflicts.

Try it: **https://schedule-builder-repo.vercel.app** (public beta, free; no account and no sign-in).

## What it does

- **Finds schedules that work.** Add your courses, block out work and life time on the calendar, and flip through the conflict-free combinations.
- **Respects how you like your week.** Prefer mornings, afternoons, days off or compact days.
- **Uses your school's catalog.** Upload the course catalog or add courses by hand in the Data Manager.
- **Tracks your degree.** Record completed courses, see what is left, forecast future semesters and calculate your GPA.
- **Keeps your data yours.** There are no accounts and no database. Your catalog, saved schedules and degree progress stay in your browser's local storage and never leave your device. No ads and no selling of user data.

## How to use it

1. Open the app and go to **Data Manager** to upload your catalog or add your courses. First-time visitors get a short welcome and a set of sample courses to try.
2. In **Builder**, pick the courses you want this term and drag on the calendar to block the times you are busy.
3. Browse the schedules it finds, set your preferences, and save the one you like.

ClassForge is built and maintained by one independent developer in Pennsylvania. It is a Next.js app with no backend database.

## Stack

- Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS 4
- Browser localStorage for all saved data (no server database)
- Node's built-in test runner (`node --test`)

## Setup

Requirements: Node.js 20 or newer. No database, account or API key is needed.

```bash
npm ci
npm run dev                  # http://localhost:3000
```

Optional configuration: copy `.env.example` to `.env.local` (never commit real values).

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` / `SITE_URL` | in production | Canonical origin for metadata, robots and sitemap |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | recommended | Contact address shown on contact, privacy and terms pages |
| `NEXT_PUBLIC_GA_ID` | no | Google Analytics 4 ID; analytics are off when empty |

Features that need accounts or a server (sign-in, the AI advisor, public reviews, the contact form and the Agent Lab) are switched off in this version and show a short "not available" message.

If no site URL is set, the app uses `VERCEL_PROJECT_PRODUCTION_URL` in Vercel production, then `VERCEL_URL`, then `http://localhost:3000`.

## Scripts

```bash
npm test         # unit tests
npm run lint     # ESLint
npm run build    # production build
npm start        # serve the production build
```

## Deploying

Any Node host that runs Next.js works. On Vercel, import the repo, optionally set the variables above in the project settings, and deploy. Keep `NEXT_PUBLIC_SITE_URL` aligned with your domain. Private routes are marked `noindex`; public pages are crawlable.

## Brand

The ClassForge name, logo and assets in `public/brand/` identify the original project. If you run your own public instance, please use your own name and branding. Brand settings live in `src/lib/brand.js`.

## Contributing and license

See `CONTRIBUTING.md`. Released under the MIT License, see `LICENSE`.
