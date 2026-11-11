# Contributing to ClassForge

Thanks for helping out.

1. Fork the repo and create a branch from `main`.
2. `npm ci`, copy `.env.example` to `.env.local`, and point it at your own Supabase project.
3. Keep changes small and focused. Add or update tests in `tests/unit/` for behaviour changes.
4. Before opening a pull request, run `npm test`, `npm run lint` and `npm run build`.
5. Never commit secrets, `.env*` files (other than `.env.example`), build output, or real user or student data.

Report security issues privately to the support address in `src/lib/brand.js` rather than in a public issue.

By contributing you agree that your contributions are licensed under the MIT License in `LICENSE`.
