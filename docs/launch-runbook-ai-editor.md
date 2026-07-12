# AI Editor launch runbook (post-merge)

Ordered; stop on any failure. LIVE-mode steps need .env.prod loaded.

1. Merge site branch → main; `git push origin main` (Vercel deploys). Verify /plugins/divi-5-ai-editor 200 in prod.
2. Prod migration: `npm run db:migrate` against prod Neon (adds 'revoked' enum value). [CONFIRM with Lucas first — db:migrate is on the always-confirm list]
3. LIVE Stripe product: `npx tsx scripts/stripe-plugin-products.ts` with LIVE key → paste STRIPE_PRICE_AI_EDITOR_PRO into Vercel prod env + .env.prod; redeploy.
4. Publish the plugin release: `npx tsx scripts/release-plugin.ts --product ai-editor-divi5-pro --version 3.0.0 --dir "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/wp-plugin" --changelog "Initial divi5lab release"` against PROD db.
   NOTE: The zip's top-level folder must be named `ai-editor-divi5`. Stage a copy of wp-plugin/ under that name before running release-plugin.ts (release-plugin zips under the folder's basename; WP's updater replaces the installed folder with it).
5. Verify prod: update-check 200 for product=ai-editor-divi5-pro; free-download 302; bad-key activate 404.
6. Stripe dashboard (LIVE): create coupon 40% off, duration=once → promotion code WAITLIST40, redeem-by = launch+7d, first-time-buyer not required.
7. Test the full LIVE loop with a real card (per Phase-2 precedent): checkout with WAITLIST40 (≈$47) → license email → activate on a real site → refund-free cancel per policy… or keep the sub as the canary. Lucas decides.
8. Loops: draft launch email to segment source=ai_editor_waitlist (subject + body to Lucas for approval BEFORE sending) — announce launch, WAITLIST40, 7-day expiry, link to /plugins/divi-5-ai-editor.
9. Watch first sales end-to-end (webhook mint, activation, update-check hits in logs).
