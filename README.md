# Melofy

AI-translated, time-synced song lyrics. Melofy detects what you're currently playing and shows the lyrics translated into your language, line-by-line in sync with the music — across a **web app** and a **browser extension**, with an **eval harness** for measuring translation quality.

Translation runs through Google **Gemini** (with OpenRouter / OpenAI as alternates), all behind one OpenAI-compatible client. Lyrics come from [LRCLIB](https://lrclib.net).

---

## Monorepo layout

pnpm workspaces + [Turborepo](https://turbo.build). Package manager is pinned via `packageManager` (use `corepack`).

| Path | Package | What it is |
|------|---------|------------|
| `apps/web` | `@melofy/web` | Next.js 14 (App Router) web app — now-playing detection, synced translated lyrics. Runs on **:3009**. |
| `apps/extension` | `@melofy/extension` | [WXT](https://wxt.dev) MV3 browser extension — an in-page lyrics widget for **YouTube Music** (which has no now-playing API, so it scrapes the player). |
| `apps/eval` | `@melofy/eval` | Standalone translation-quality eval dashboard (Express + Vite). Talks to the running web app over HTTP; imports zero product code. |
| `packages/core` | `@melofy/core` | Shared TypeScript (types, supported languages) consumed by the apps. |
| `infra/` | — | Docker Compose for local Mongo + Redis (and a production web image), plus a self-hosted **Langfuse** stack. |
| `tools/` | — | Build-time helpers: the Python GlotLID eval pipeline, gold-reference review, model experiments. |

---

## Prerequisites

- **Node ≥ 20**
- **pnpm 9.15.4** — `corepack enable && corepack prepare pnpm@9.15.4 --activate`
- **Docker** (for local MongoDB + Redis)

---

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.local.example .env      # then fill in the values you need (see below)

# 3. Start MongoDB + Redis
pnpm docker:up

# 4. Run the web app  → http://localhost:3009
pnpm dev:web
```

Everything reads a **single root `.env`** — see [`.env.local.example`](./.env.local.example) for the full, annotated list.

### Minimum to translate

- `GEMINI_API_KEY` — the translation model (`google/gemini-flash-latest`).
- `MONGO_URI`, `REDIS_URL` — provided by `pnpm docker:up` defaults.

Everything else (Spotify OAuth, analytics, tracing, BYOK) is optional and degrades gracefully when unset.

---

## Running each surface

```bash
pnpm dev:web        # web app on :3009
pnpm dev:ext        # extension in dev mode (WXT) — load the printed dir as an unpacked extension
pnpm dev:eval       # eval dashboard (API + UI)

pnpm build          # build everything (turbo)
pnpm build:ext      # production extension → apps/extension/.output/chrome-mv3
pnpm build:ext:firefox
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint
```

### Browser extension

`pnpm build:ext` produces `apps/extension/.output/chrome-mv3`. Load it via `chrome://extensions` → *Load unpacked*. On `music.youtube.com` a lyrics widget appears; the popup has a global on/off toggle and a BYOK key setting. The extension calls the web app's API, so keep `pnpm dev:web` (or a deployed instance) running.

---

## How it works (short version)

- **Translation** — `apps/web/src/lib/services/translation.ts`. One OpenAI-compatible client routed by model slug: `google/*` → Gemini, other `/` slugs → OpenRouter, bare names → OpenAI. Two-step by default: a context **brief** (theme + slang/idiom glossary) then line-by-line translation, streamed as NDJSON.
- **Caching** — client IndexedDB → server Redis + MongoDB → LRCLIB + model. Cache key is a normalized `sha256(artist|title|lang)`.
- **Cost guards** — a per-IP daily free-translation limit (hashed IP, Redis), plus **BYOK**: users can supply their own key, encrypted in transit (RSA-OAEP) and never stored server-side.
- **Shared server policy** — both the web streaming route and the extension route go through `lib/services/translationApi.ts`, so cache / limit / BYOK / error behavior can't drift between surfaces.

---

## Eval harness

Measures translation quality (fidelity / fluency / slang-idiom) against reference translations, with an LLM-as-a-judge.

```bash
pnpm dev:eval                 # dashboard: trigger runs, switch models, see scores
pnpm eval:dataset:from-db     # rebuild the dataset from cached translations in MongoDB
pnpm eval:dataset:sync        # push the dataset into a Langfuse dataset
```

The dataset lives at `apps/eval/dataset/dataset.json`. Judge/candidate model API keys are read from the root `.env`.

### Langfuse (optional, local, dev-only)

Langfuse tracing is **additive and off by default** — a no-op unless `LANGFUSE_*` keys are set. To run it locally:

```bash
pnpm langfuse:up      # heavy self-host stack (postgres, clickhouse, redis, minio, web, worker)
# open http://localhost:3780 → create a project → copy keys into root .env
pnpm langfuse:down
```

Set `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL=http://localhost:3780` in `.env`. Bring the stack up only when doing eval work.

---

## Analytics & observability (optional)

Both are no-ops until keys are present:

- **PostHog** — product analytics. Server-side capture of translation/rate-limit events (web + extension), a privacy-conscious client funnel, extension events routed via `/api/analytics/event`. Set `NEXT_PUBLIC_POSTHOG_KEY` (and optionally `POSTHOG_KEY`).
- **Langfuse** — LLM-call tracing in the web translation pipeline and the eval harness (see above).

---

## Environment variables

All in the root `.env`. The template [`.env.local.example`](./.env.local.example) is annotated; the essentials:

| Var | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | Translation model (Gemini). |
| `OPEN_ROUTER_API_KEY` / `OPENAI_API_KEY` | Alternate providers / eval judge models. |
| `OPENAI_MODEL` | Translation model slug (default `google/gemini-flash-latest`). |
| `MONGO_URI` / `REDIS_URL` | Datastores (defaults match `pnpm docker:up`). |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` / `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` | Spotify now-playing (optional). |
| `DAILY_TRANSLATION_LIMIT` / `RATE_LIMIT_SALT` / `BYOK_PRIVATE_KEY` | Free-tier rate limit + BYOK. |
| `NEXT_PUBLIC_POSTHOG_KEY` / `POSTHOG_KEY` | PostHog analytics (optional). |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` | Langfuse tracing (optional). |

---

## Docker

```bash
pnpm docker:up      # MongoDB (:27018) + Redis (:16379) for local dev
pnpm docker:down
```

A production web image is defined at `infra/Dockerfile.web` / `infra/docker-compose.yml` (`app` service, opt-in).

---

## Notes

- Lyrics are fetched from LRCLIB for personal, non-commercial use.
- The web app and extension share one translation policy and cache, so a song translated on one surface is a free cache hit on the other.
