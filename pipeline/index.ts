// LayoutLab generation pipeline — CLI entry point.
//
// Modes:
//   npm run pipeline -- batch              # big-bang catalog generation
//   npm run pipeline -- drip --count=N     # steady drip
//
// Per-layout flow (idempotent + resumable), see CLAUDE.md §10:
//   plan → generate → validate → dedupe → render → seo → upload → ingest
//
// Build each step test-first under pipeline/*.ts. This is a Phase 3 stub.

async function main() {
  const mode = process.argv[2];
  switch (mode) {
    case 'batch':
      console.log('[pipeline] batch mode — not yet implemented (Phase 3)');
      break;
    case 'drip':
      console.log('[pipeline] drip mode — not yet implemented (Phase 3)');
      break;
    default:
      console.log('Usage: npm run pipeline -- <batch|drip [--count=N]>');
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
