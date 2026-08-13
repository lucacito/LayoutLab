# Task 1 Report — Pure per-assistant connection builder

## Note on brief location

The instructions pointed to `/Users/Lucas/Documents/JHMG-Local/layoutlab/.superpowers/task-1-brief.md`,
which does not exist. The actual brief was found at
`/Users/Lucas/Documents/JHMG-Local/layoutlab/.superpowers/sdd/task-1-brief.md`
(a copy also exists under `.claude/worktrees/phase5-site/.superpowers/sdd/task-1-brief.md`).
Used the `sdd/` copy verbatim; no other differences noted.

## What was implemented

Added a new pure static method `AdminPage::connectClients(string $siteUrl, string $apiKey): array`
to `wp-plugin/src/AdminPage.php` in the plugin repo
(`/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator`).

It returns per-assistant connection config keyed by client id (`claude`, `cursor`, `vscode`,
`chatgpt`, `other`), each with `transport`, `snippet`, `guide`, `specUrl`:

- `claude` / `cursor` / `other` — MCP transport, `{"mcpServers":{"ai-editor-divi5":{url, headers.Authorization}}}` snippet.
- `vscode` — MCP transport, VS Code's `mcp.json` shape: `{"servers":{"ai-editor-divi5":{type:"http", url, headers.Authorization}}}`.
- `chatgpt` — `actions` transport, `snippet: null`, non-null `specUrl` pointing at the OpenAPI spec.

`siteUrl` is `rtrim(..., '/')`-normalized before building URLs. No WordPress calls beyond
`wp_json_encode` (shimmed in `tests/bootstrap.php`), matching the existing `connection()` pattern,
so it is directly unit-testable with synthetic inputs.

Placed exactly above the existing `private function connection()` (which is untouched — a later
task removes it).

## Files changed

- `wp-plugin/src/AdminPage.php` — added `connectClients()` (45 lines added, nothing else touched).
- `tests/ConnectClientsTest.php` — new file, 6 test methods, copied verbatim from the brief.

Both committed together; nothing else in the working tree was modified.

## TDD evidence

### Step 2 — RED (test written, method not yet implemented)

Command:
```
cd "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator" && vendor/bin/phpunit --filter ConnectClientsTest
```

Output:
```
PHPUnit 11.5.55 by Sebastian Bergmann and contributors.

Runtime:       PHP 8.5.7
Configuration: /Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/phpunit.xml

EEEEEE                                                              6 / 6 (100%)

Time: 00:00.015, Memory: 10.00 MB

There were 6 errors:

1) Divi5Validator\Tests\ConnectClientsTest::testHasAllFiveClients
Error: Call to undefined method AiEditorDivi5\WP\AdminPage::connectClients()
...
ERRORS!
Tests: 6, Assertions: 0, Errors: 6.
```

All 6 failed with the expected "Call to undefined method" error — confirms the test file
correctly exercises code that doesn't exist yet.

### Step 4 — GREEN (after implementing `connectClients()`)

Command:
```
cd "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator" && vendor/bin/phpunit --filter ConnectClientsTest
```

Output:
```
PHPUnit 11.5.55 by Sebastian Bergmann and contributors.

Runtime:       PHP 8.5.7
Configuration: /Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/phpunit.xml

......                                                              6 / 6 (100%)

Time: 00:00.008, Memory: 10.00 MB

OK (6 tests, 32 assertions)
```

### Full suite (before commit, and re-confirmed after commit)

Command:
```
cd "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator" && vendor/bin/phpunit
```

Output:
```
PHPUnit 11.5.55 by Sebastian Bergmann and contributors.

Runtime:       PHP 8.5.7
Configuration: /Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/phpunit.xml

................................................................. 65 / 77 ( 84%)
............                                                      77 / 77 (100%)

Time: 00:00.039, Memory: 10.00 MB

OK (77 tests, 310 assertions)
```

77 tests / 310 assertions, all green, including the pre-existing `McpConfigSnippetTest.php`
(unmodified) and all other suites.

## Commit

```
4a4e655 feat(admin): pure per-assistant connect builder (connectClients)
 2 files changed, 137 insertions(+)
 create mode 100644 tests/ConnectClientsTest.php
```

`git status --short` after commit is empty — clean tree.

## Self-review

- Test asserts real behavior: yes — every test decodes the actual JSON `snippet` string via
  `json_decode` and checks the decoded shape (`mcpServers.ai-editor-divi5.url`/`.headers.Authorization`,
  `servers.ai-editor-divi5.type`, absence of `mcpServers` key for vscode, etc.), not just presence
  of keys. `testTrailingSlashOnSiteUrlIsNormalized` re-invokes `connectClients()` with a trailing
  slash and asserts the URL is normalized (no double slash), so the `rtrim` logic is exercised
  directly rather than assumed.
- All 6 test methods present: `testHasAllFiveClients`, `testMcpClientsUseMcpServersShapeWithBearerKey`,
  `testVsCodeUsesServersTypeHttpShape`, `testChatgptUsesActionsWithSpecUrlAndNoSnippet`,
  `testEachClientLinksToItsGuide`, `testTrailingSlashOnSiteUrlIsNormalized`.
- Full suite green with pristine output: confirmed twice (pre-commit and post-commit), 77/77,
  no warnings/deprecations in the output shown above.
- Only the two intended files changed: confirmed via `git status --short` and `git diff --stat`
  immediately before staging — `wp-plugin/src/AdminPage.php` (45 insertions only) and the new
  `tests/ConnectClientsTest.php`.
- `connection()` untouched: confirmed via `git diff wp-plugin/src/AdminPage.php` — the diff is a
  pure insertion block ending right before `/** Connection details + a ready-to-paste config
  snippet. */` / `private function connection()`, with no lines removed or modified anywhere in
  the file.

## Concerns

- Brief file path mismatch (see note above) — the task instructions' stated path doesn't exist;
  used the `sdd/` copy, which is byte-identical in the relevant Step 1/3 code blocks to what the
  instructions described. Flagging in case the two copies are expected to be kept in sync or the
  top-level copy is expected to exist as canonical.
- None on the implementation itself — this is data-only, no WordPress runtime dependency beyond
  the already-shimmed `wp_json_encode`, and the later removal of `connection()` (a different task)
  is unaffected since it wasn't touched.
