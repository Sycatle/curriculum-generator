# CV Generator

A self-hosted, open-source CV generator with live preview and clean PDF export.
Built for developers who would rather edit content than fight with Canva.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Stack](https://img.shields.io/badge/stack-Next.js%2015%20·%20TypeScript%20·%20Postgres%20·%20Drizzle-0f172a)
![PDF](https://img.shields.io/badge/PDF-A4%20single--or%20multi--page-2563eb)

> **Live demo**: [`/showcase`](http://localhost:3030/showcase) (self-hosted). See the layout and the design tokens in action without signing up.

## Features

- **Live PDF preview** while you edit — no rebuild loop
- **PDF export** powered by `@react-pdf/renderer`, A4, with single-page auto-fit or natural multi-page pagination
- **Three templates**: `modern` (two-column legacy), `premium` (single-column), and `ats` (single-column, parser-friendly)
- **Design tokens** (colors, fonts, spacing, accent style) drive both PDF and HTML
- **Drag & drop reorder** for experiences, projects, skills, languages, education
- **Undo/redo** (`⌘Z` / `⌘⇧Z`) with a 50-step history stack
- **Keyboard shortcuts**: `⌘S` save now · `⌘P` toggle preview · `⌘K` command palette
- **OCR import**: drop an old CV (PDF or image) — Claude extracts a structured draft
- **AI assistant**: in-editor chat with tool-calling to rewrite bullets, add experiences, retarget the CV — every change reviewed in a diff before applying
- **Public shareable URL** with HTML rendering + PDF download
- **Snapshot history**: every save creates a restorable revision
- **Multi-user**: GitHub OAuth or magic link sign-in via Better-Auth
- **Self-hosted by design**: Docker Compose + Caddy on your own VPS
- **Secrets via SOPS** — commit encrypted env files, decrypt at deploy time

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · PostgreSQL 16 · Drizzle ORM ·
Better-Auth · `@react-pdf/renderer` · Zod · shadcn/ui patterns · Anthropic SDK
(Claude) · Vitest · Playwright · Docker · Caddy · GitHub Actions.

## Architecture

```
app/                 Next.js routes (auth, dashboard, public CV, API)
  api/auth/[...all]  Better-Auth handler
  api/cv/[id]/pdf    Streamed PDF (auth or public)
  api/cv/[id]/chat   AI assistant streaming (NDJSON, tool-calling loop)
  api/cv/import      OCR multimodal extraction (PDF/PNG/JPG/WebP)
  api/health         Healthcheck (Docker / probes)
  cv/[id]            Public HTML CV
lib/
  auth/              Better-Auth config + email transport
  db/                Drizzle schema + client
  cv/                Domain (Zod schemas, repository, defaults)  ── pure
  pdf/               React-PDF template + tokens + render        ── pure
  ai/                Anthropic client, OCR extractor, agent tools + loop
components/
  cms/               Editor form (per-section, accordion)
  preview/           Live PDF viewer + HTML renderer
  ui/                Reusable primitives
docker/              Dockerfile entrypoint + Caddyfile
secrets/             SOPS-encrypted env files (templates committed)
tests/
  unit/              Vitest (Zod, repository, PDF)
  e2e/               Playwright smoke
```

The `lib/cv/` domain has no React or PDF dependency.
The `lib/pdf/` layer takes validated `CvData` as input and knows nothing about the DB.
UI components never touch the DB directly — always go through Server Actions or route handlers.

## Quickstart (local dev)

Requires Node 20+, pnpm 9+, Docker.

```bash
# 1. Install
pnpm install

# 2. Bring up Postgres
pnpm db:up

# 3. Configure env
cp .env.example .env
# Generate a secret:
openssl rand -hex 32   # paste into BETTER_AUTH_SECRET

# 4. Apply migrations
pnpm db:generate    # only if you edited the schema
pnpm db:migrate

# 5. Run
pnpm dev
# → http://localhost:3000
```

Without `SMTP_HOST` set, magic-link emails are printed to the dev console — copy the link from the terminal to sign in.

To enable the AI features (OCR import + chat assistant), set `ANTHROPIC_API_KEY`
in `.env`. Without it, the rest of the app still works — only `/cvs/import` and
the editor's "Assistant" panel are disabled. See [`docs/ai.md`](docs/ai.md) for
how it works, the cost envelope, and which models are used.

## Tests

```bash
pnpm test          # unit + integration (requires Postgres up)
pnpm test:e2e      # Playwright smoke (boots its own dev server)
pnpm typecheck
pnpm lint
```

## Deployment (VPS)

This project is designed for a small VPS running Docker.

### One-time setup

1. Install Docker + Docker Compose on the VPS.
2. Install [SOPS](https://github.com/getsops/sops) and [age](https://github.com/FiloSottile/age) on your machine and the VPS.
3. Generate an age key: `age-keygen -o ~/.config/sops/age/keys.txt`. Put the **public** key into `.sops.yaml` and replicate the **private** key to the VPS at the same path.
4. Fill in `secrets/.env.production.example` and `secrets/.env.postgres.example`, save them as `secrets/.env.production` / `secrets/.env.postgres`, then encrypt:

   ```bash
   sops -e -i secrets/.env.production
   sops -e -i secrets/.env.postgres
   ```

5. Commit the encrypted files. Plaintext files are gitignored.

### Deploy

GitHub Actions builds the image, pushes it to GHCR, and SSHs into the VPS to:

```
sops -d secrets/.env.production > .env.production
sops -d secrets/.env.postgres   > .env.postgres
docker compose pull
docker compose up -d --remove-orphans
```

Required GitHub Actions secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, plus `SOPS_AGE_KEY` if you decrypt in CI instead of on the VPS.

### Backups

See [`docs/ops/backup.md`](docs/ops/backup.md).

## Why this project (recruiters, this is for you)

- **Production-grade, not a toy**: type-safe end-to-end (Zod + Drizzle types), tested (vitest + playwright), CI/CD, SOPS-encrypted secrets, observability-ready.
- **Two-front cohesion**: a single `Theme` object drives both the React-PDF document AND the HTML view. Same tokens, same layout, no drift.
- **Tasteful UX**: undo/redo, drag & drop, ⌘K command palette, autosave with visible status. Built like a product.
- **Self-hosted from day one**: no SaaS lock-in, no analytics SDK, no telemetry — your CV stays on your machine.

Browse `/showcase` for the rendering, then read `lib/pdf/template.tsx` and `lib/cv/schema.ts` to see how it's built.

## Roadmap (post-V1)

- Profile photo upload + `sharp` resize pipeline
- Multi-language CV (FR / EN side-by-side, bilingual export)
- Targeted CV variants (full-stack / freelance / lead) sharing a pool of experiences
- ATS-friendliness scoring + suggestions (extend the existing AI assistant)
- Import from LinkedIn export / JSON Resume
- Per-user AI usage tracking and rate limit (currently unlimited at app level)
- Loki/Grafana observability stack

## License

MIT — see [LICENSE](LICENSE).
