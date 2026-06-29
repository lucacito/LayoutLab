# Paid Pack-Bundle Download — Design

**Status:** Approved (continues the free-first model) — 2026-06-29
**Predecessor:** Free individual downloads (individual layouts free; packs/all-access paid).

---

## Goal

Make **packs the real paid SKU**: an entitled user downloads a whole pack as **one
zip** (every layout's JSON + the commercial license), gated by **entitlement**
(owns the pack OR active all-access). This is the paid value — bundled, one-click,
no per-layout email gate.

---

## Decisions

1. **Login + entitlement gated** (unlike the free individual path which is
   email-cookie gated). A pack bundle is paid content → the user must be signed in
   AND entitled. `requireUser` → resolve user → `canDownloadPack` (new SSOT helper)
   → 403 if not entitled.
2. **One zip per pack:** `<pack-slug>.zip` containing `<layout-slug>.json` for each
   published layout in the pack + `LICENSE.txt`.
3. **Works for free packs too:** a free pack, once captured (5b grants a
   `pack:<id>` entitlement), is downloadable via the same gate. So the pack-detail
   CTA is: entitled → "Download pack"; else paid → Buy; else free → capture form.

---

## Architecture & flow

```
GET /api/download/pack/[packId]   (runtime nodejs)
  · requireUser()                              → redirect /login if not signed in
  · userId = session email → getUserIdByEmail
  · pack = getPackForDownload(packId)          → 404 if not a published pack
  · entitlements = getEntitlementsForUser(userId)
  · canDownloadPack({ packId, userEntitlements }) → 403 if not entitled (owns pack OR all-access)
  · layouts = getPackLayoutsForDownload(packId)   (published layouts: slug + blob key)
  · fetch each asset (fetchAsset); keep those with bytes
  · if none have bytes → 404 asset_unavailable
  · buildPackZip(items, LICENSE)               · recordDownload per included layout (audit)
  ▼ stream application/zip (attachment "<pack-slug>.zip")

Pack detail page (server): compute entitled = canDownloadPack(...) for the session user
  · entitled         → "Download pack (N layouts)" → /api/download/pack/[id]
  · else paid pack   → <BuyButton>
  · else free pack   → <FreePackForm>  (capture → entitlement → sign in → entitled)
```

---

## Components / units

### 1. Entitlement SSOT — `lib/stripe/entitlements.ts`
- `canDownloadPack(input: { packId: string; userEntitlements: UserEntitlement[]; now?: Date }): boolean`
  — true if active all-access OR `userEntitlements` contains `pack:${packId}`.
  (Mirrors `canDownloadLayout`'s pack/all-access rule; the existing
  `isActiveAllAccess` is reused.)

### 2. Zip — `lib/download/zip.ts`
- `buildPackZip(layouts: { slug: string; json: string }[], license: string): Promise<Buffer>`
  — a zip of each `<slug>.json` + one `LICENSE.txt` (pure; jszip). Unit-tested.

### 3. Queries — `lib/account/queries.ts`
- `getPackForDownload(packId): Promise<{ id: string; slug: string } | null>` (published packs only).
- `getPackLayoutsForDownload(packId): Promise<{ slug: string; diviJsonBlobKey: string }[]>`
  (published layouts in the pack). (`getEntitlementsForUser`/`getUserIdByEmail`/
  `recordDownload` already exist.)

### 4. Route — `app/api/download/pack/[packId]/route.ts`
- Per the flow above. `requireUser` (paid → must be signed in), `canDownloadPack`
  gate, `buildPackZip`, `recordDownload` per included layout, stream.

### 5. Pack detail UI — `app/(catalog)/packs/[slug]/page.tsx` + `components/PackDownloadButton` (or inline link)
- Server computes `entitled` (session → entitlements → `canDownloadPack`). The
  price/CTA block renders the **Download pack** link when entitled, else the
  existing Buy (paid) / capture (free) CTA. Optionally surface the same link on
  `/account/purchases` for owned packs (nice-to-have).

---

## Error handling & security

- Not signed in → `requireUser` redirects to `/login` (the buyer signs in via magic
  link, then returns). Signed in but not entitled → `403 forbidden` (no bytes).
- A pack with no resolvable assets (seed placeholders) → `404 asset_unavailable`
  (only pipeline-generated layouts have real JSON).
- The asset is served only through this gated route; entitlement is the gate
  (§2 honored — paid content requires a valid entitlement). Secrets server-only.
- Audit: a `downloads` row per included layout.

## Testing strategy (TDD)

- **Unit:** `canDownloadPack` (all-access → true; owns `pack:<id>` → true; neither →
  false; expired all-access ignored); `buildPackZip` (unzip → each `<slug>.json` +
  `LICENSE.txt`, correct bytes).
- **Route (mocked deps):** `/api/download/pack/[id]` → redirect/401 when not signed
  in (requireUser), 403 when signed-in-not-entitled, 404 unknown pack, 200 zip when
  entitled (owns pack or all-access), 404 when no assets resolve; `recordDownload`
  only on success.
- **Component:** the pack-detail CTA renders the Download link when entitled, Buy
  when a non-entitled paid pack, the capture form when a non-entitled free pack.
- **Integration (gated POSTGRES_URL):** `getPackForDownload` published-only;
  `getPackLayoutsForDownload` returns the pack's published layouts.
- **Manual:** own a pack (4a test purchase, or capture a free pack) → pack page shows
  "Download pack" → a zip with the pack's layout JSONs + LICENSE; a non-owned paid
  pack shows Buy; `/api/download/pack/<id>` while not entitled → 403.

## Out of scope
- Per-pack `downloads` rollup / rate-limit tuning; zip streaming for very large
  packs (fine at current sizes); private Blob + signed URLs (separate, tracked).
