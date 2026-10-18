# Hoot

Mobile-first PWA that turns exam dates, study sources and exam questions into a daily study plan, and re-plans automatically when the plan slips.

- Specification: [docs/PRD.md](docs/PRD.md) (Bosnian)
- Screen designs: [docs/design/](docs/design/README.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Stack

React + TypeScript + Vite, Tailwind + shadcn/ui, TanStack Query, Supabase (Postgres + RLS, Auth, Storage, Edge Functions), Claude Haiku via Edge Functions, Cloudflare Pages.

## Branches

- `main` — production (`hoot-5ig.pages.dev`)
- `dev` — integration, default branch
- `feat/*`, `fix/*`, `chore/*`, `docs/*` — branch off `dev`, PR into `dev`
