<div align="center">

# CV Generator

**Edit your content, not your layout.**
A self-hosted CV builder with live PDF preview, an ATS score, and a job-search toolkit built in.

[![CI](https://github.com/Sycatle/cv-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/Sycatle/cv-generator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)

[Features](#features) · [Quickstart](#quickstart) · [Architecture](#architecture) · [Deployment](#deployment) · [Roadmap](#roadmap)

</div>

---

## Why

Most CV tools hand you a design and a paywall. This one gives you a typed data model, three templates driven by the same design tokens, and checks that tell you how a parser and a recruiter will read the result. Your data stays on your server: no SaaS lock-in, no analytics SDK, no telemetry.

## Features

### Write

- **Live PDF preview** while you type, no rebuild loop
- **Three templates**: `ats` (single column, parser-friendly), `premium` (single column) and `modern` (two columns)
- **One design system for PDF and HTML**: colors, fonts, spacing and accent style come from a single `Theme`
- **Single-page auto-fit** that reports exactly what it trims, or natural multi-page pagination
- **Per-CV locale** (`fr` / `en`): section headings, date formats and labels follow the language
- **Editor comforts**: drag and drop reordering, undo/redo (50 steps), autosave, snapshot history, `⌘S` save, `⌘P` preview, `⌘K` command palette

### Check

- **ATS score (0 to 100)** from deterministic checks, no AI call: missing sections, summary length, skill overload, unproven skills, weak or missing verbs, metrics, date gaps and overlaps, stack per job
- **ATS text preview**: the plain text a parser extracts from your PDF
- **Job match**: paste an offer, see which keywords are proven in your experience and which are only listed in your skills

### Export and share

- **PDF** (A4, `@react-pdf/renderer`) with proper metadata and a download name based on your name
- **DOCX** export, localized like the PDF
- **Public share link** with an HTML view and a PDF download, set to `noindex`

### Assist (optional, needs `ANTHROPIC_API_KEY`)

- **OCR import**: drop an old CV (PDF or image) and get a structured draft
- **Chat assistant** with tool calling: rewrite bullets, add experiences, retarget the CV. Every change is shown as a diff before it is applied. See [`docs/ai.md`](docs/ai.md)

### Search

- **Job sources and postings**, **company discovery and enrichment**, **application tracking**, and **outreach** with batch sending, delivery webhooks and one-click unsubscribe

### Run it yourself

- **Multi-user** sign-in with GitHub OAuth or magic link ([Better Auth](https://www.better-auth.com))
- **Docker Compose + Caddy** on your own VPS, **secrets encrypted with SOPS**

## Stack

| Layer     | Tools                                                          |
| --------- | -------------------------------------------------------------- |
| App       | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Data      | PostgreSQL 16, Drizzle ORM, Zod                                |
| Documents | `@react-pdf/renderer`, `docx`                                  |
| Auth      | Better Auth                                                    |
| AI        | Anthropic SDK                                                  |
| Quality   | Vitest, Playwright, ESLint, Prettier, GitHub Actions           |
| Ops       | Docker, Caddy, SOPS + age                                      |

## Quickstart

Requires Node 20+, pnpm 9+ and Docker.

```bash
pnpm install
pnpm db:up                      # PostgreSQL in Docker
cp .env.example .env            # then set BETTER_AUTH_SECRET: openssl rand -hex 32
pnpm db:migrate
pnpm dev                        # http://localhost:3000
```

Without `SMTP_HOST`, magic-link emails are printed in the dev console: copy the link from the terminal to sign in. Without `ANTHROPIC_API_KEY`, only OCR import and the chat assistant are disabled.

Browse `/showcase` to see the templates and design tokens without signing in.

## Architecture

```
app/                 Routes: auth, dashboard, public CV, API
  api/cv/[id]/pdf     Streamed PDF, with an X-CV-Fit header
  api/cv/[id]/docx    DOCX export
  api/cv/[id]/chat    AI assistant (NDJSON streaming, tool-calling loop)
  api/cv/import       OCR extraction (PDF, PNG, JPG, WebP)
  api/jobs, companies, outreach, cron, webhooks
lib/
  cv/                 Domain: Zod schemas, ATS checks, job match, labels, repository   (pure)
  pdf/                React-PDF templates, tokens, fit cascade, render                  (pure)
  ai/                 Anthropic client, OCR extractor, agent tools
  jobs/ companies/ outreach/   Job-search toolkit
  auth/ db/           Better Auth config, Drizzle schema and client
components/           cms/ (editor), preview/ (PDF and HTML), ui/ (primitives)
docker/               Entrypoint and Caddyfile
secrets/              SOPS-encrypted env files (templates committed)
tests/                unit/ (Vitest), e2e/ (Playwright smoke)
```

Three rules keep it tidy:

- `lib/cv/` has no React and no PDF dependency.
- `lib/pdf/` takes validated `CvData` and knows nothing about the database.
- UI components never reach the database directly: they go through Server Actions or route handlers.

The `ats` template follows parser constraints on purpose: text only, no icons, no tracked headings (which extract as `P R O F I L`), standard section names and a body size that never goes below 9 pt.

## Development

```bash
pnpm test          # unit tests (Vitest)
pnpm test:e2e      # Playwright smoke test, starts its own dev server
pnpm typecheck
pnpm lint
```

The ATS thresholds live in [`lib/cv/ats-checks.ts`](lib/cv/ats-checks.ts) and are documented against [`docs/research/cv-watch-2026.md`](docs/research/cv-watch-2026.md).

## Deployment

Designed for a small VPS running Docker.

**One-time setup**

1. Install Docker and Docker Compose on the VPS.
2. Install [SOPS](https://github.com/getsops/sops) and [age](https://github.com/FiloSottile/age) locally and on the VPS.
3. Generate a key with `age-keygen -o ~/.config/sops/age/keys.txt`. Put the public key in `.sops.yaml` and copy the private key to the same path on the VPS.
4. Fill in `secrets/.env.production.example` and `secrets/.env.postgres.example`, save them without the `.example` suffix, then encrypt:

   ```bash
   sops -e -i secrets/.env.production
   sops -e -i secrets/.env.postgres
   ```

5. Commit the encrypted files. Plaintext ones are gitignored.

**Deploy.** GitHub Actions builds the image, pushes it to GHCR, then connects to the VPS over SSH to decrypt the secrets and run `docker compose pull && docker compose up -d --remove-orphans`.

Required Actions secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, plus `SOPS_AGE_KEY` if you decrypt in CI rather than on the VPS.

**Backups**: see [`docs/ops/backup.md`](docs/ops/backup.md).

## Roadmap

- [ ] Profile photo upload with a resize pipeline
- [ ] Targeted CV variants (full stack, freelance, lead) sharing one pool of experiences
- [ ] Import from LinkedIn export and JSON Resume
- [ ] Per-user AI usage tracking and rate limits
- [ ] Observability stack (Loki, Grafana)

## License

[MIT](LICENSE) © 2026 sycatle
