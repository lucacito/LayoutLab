# Divi5Lab

> Divi 5 layout marketplace · **divi5lab.com**

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

### Public catalog caching

Public catalog pages, taxonomy copy/facet counts, and sitemap database reads use
`lib/catalog/public-queries.ts` and `lib/seo/public-taxonomy.ts`. They share Next's
Data Cache across requests, keyed by query name and arguments, with a 300-second
revalidation interval. Database dates are restored after cache serialization.

Only display reads opt in. The original query modules remain uncached for
checkout, downloads, authorization, admin, and scripts. Do not import the public
cached wrappers into these paths.

Publishing, unpublishing, edits, and displayed prices may remain stale until a
request triggers revalidation after five minutes; that request can receive the
old result while refreshing in the background. Failed refreshes may retain older
cached data. Checkout must continue validating live prices and permissions.
There is no background polling timer. This reduces repeated database reads but
is not a guarantee that Neon will suspend: cache misses across different pages,
preview traffic, and other database clients can still keep it active. After
merging/deploying, compare Neon CU-hours and active time over comparable traffic
windows, not query execution time alone.
