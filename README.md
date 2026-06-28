# LayoutLab

> Placeholder name — find-and-replace `LayoutLab` / `layoutlab` once the real
> brand + domain are chosen.

A marketplace that sells **AI-generated Divi 5 layouts** as downloadable JSON,
plus the automated pipeline that generates, screenshots, SEO-optimizes, and
publishes them at scale.

- **Web app** — Next.js (App Router) on Vercel: catalog, accounts, Stripe
  checkout, signed downloads, admin approval queue, programmatic SEO.
- **Pipeline** (`pipeline/`) — Claude → the deterministic Divi 5 validator →
  Docker WP+Divi render → Playwright screenshots → Vercel Blob → ingest API.

**Read [`CLAUDE.md`](./CLAUDE.md) — it is the full project spec and the
instructions for building this with Claude Code + the Superpowers plugin.**

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:migrate
npm run db:seed
npm run dev
```

The validator and the Docker WP+Divi render env live in the sibling repo
`../Divi 5 Deterministic Validator` (run `make up` there).
