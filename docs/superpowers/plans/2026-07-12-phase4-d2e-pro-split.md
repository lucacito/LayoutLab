# Phase 4: Divi→Elementor Free/Pro Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Divi→Elementor converter into a wp.org-compliant free plugin (single-file, single-layout conversion) and a Pro companion ($49/yr: batch/multi-file, all-layouts, WooCommerce widget mapping, Theme Builder import) wired to divi5lab's live license API — ready to launch the moment wordpress.org approves the free plugin.

**Architecture:** Mirror of the proven Phase 2 split (jhmg-elementor-to-divi5). The free plugin gains seams (`jhmgcofo_loaded` action; `jhmgcofo_pro_active`, `jhmgcofo_convert_module`, `jhmgcofo_max_layouts` filters) and is TRIMMED per Lucas's boundary decision (2026-07-12): WooCommerce mappings, multi-file/multi-layout batch, and Theme Builder handling move OUT (guideline 5 — the plugin is pre-approval, so the FIRST public release is already the trimmed one; no public claw-back). The Pro plugin hooks the seams with its own non-colliding `jhmgcofop_*` dispatch identifiers (Phase 2's Critical lesson) and ships the synced license client — which first gets parameterized in the canonical copy (its admin slug + product URL are currently hardcoded to the E2D5 product).

**Tech Stack:** PHP 8.0+/WP 5.9+, PHPUnit 13 (repo currently has PURE-unit tests, no WP stubs — a stub bootstrap gets ported from the sibling), wp.org SVN (post-approval), layoutlab license API (live), docker WP on :8001 for e2e.

**Repos:**
- `D2E_REPO` = `/Users/Lucas/Documents/JHMG-Local/jhmg-divi-to-elementor` — free plugin at `plugin/jhmg-converter-divi-to-elementor/`, Pro (new) at `plugin/jhmg-converter-divi-to-elementor-pro/`. Tests: `vendor/bin/phpunit` (45 unit tests green today).
- `E2D5_REPO` = `/Users/Lucas/Documents/JHMG-Local/jhmg-elementor-to-divi5` — receives the re-synced parameterized license client (its Pro suite must stay green).
- `SITE_REPO` = `/Users/Lucas/Documents/JHMG-Local/layoutlab` — canonical license client lives here.

## Global Constraints

- **Pro boundary (Lucas, 2026-07-12, matches live site copy):** FREE = one JSON file per upload, first layout converted (extra layouts reported with an upsell note), `et_theme_builder` files blocked with upsell, WooCommerce modules degrade to a report warning + upsell. PRO = multi-file upload, all layouts per file, `et_theme_builder` → Elementor library templates, the 11 `wc_*` module → Elementor Pro widget mappings.
- Product slug exactly `divi-to-elementor-pro` (Stripe product + license API + `STRIPE_PRICE_DIVI2ELEM_PRO` all live already).
- Frozen license API contract (endpoints, snake_case params, error codes `invalid_key|product_mismatch|license_not_usable|rate_limited|invalid_request`). SOFT enforcement: license gates updates + notices only; features never lock.
- Free namespace `DiviElementorConverter\` / prefix `JHMGCOFO_` / options-transients `jhmgcofo_*` (existing). Pro namespace `DiviElementorConverter\Pro\` / prefix `JHMGCOFOP_` / options `jhmgcofop_*` / ALL dispatch action + nonce identifiers `jhmgcofop_*` — zero string collision with free's dispatcher (`jhmgcofo_import`, `jhmgcofo_action`, `jhmgcofo_publish_*`, nonce names) — Phase 2 shipped a Critical because of exactly this.
- Guideline 5: after the trim, the free plugin tree contains NO Pro feature code (no `wc_*` widget mappings, no TB import path, no multi-file loop). Upsell links point to `https://divi5lab.com/plugins/divi-to-elementor?utm_source=plugin&utm_medium=upsell` — links allowed, locked code not.
- Neither plugin fatals without the other. Pro guards on `class_exists( \DiviElementorConverter\Plugin::class )`. Free's filters default to free behavior.
- Canonical license client: edit ONLY `SITE_REPO lib/license-server/php-client/class-license-client.php`, then `scripts/sync-license-client.sh` (extend it for the second destination); plugin copies are never hand-edited; copies must stay byte-identical to canonical.
- The sibling E2D5 Pro suite (`E2D5_REPO vendor/bin/phpunit`, 321 green) must stay green after the client re-sync.
- Launch steps (wp.org first release, Pro prod publish, site flip) are OPERATOR-GATED on wordpress.org approval — build everything, hold the triggers.
- House rules: TDD; full suite + `php -l` sweep (`find plugin -name '*.php' -exec php -l {} \;`) before each plugin-repo commit; work on branch `feat/pro-split` in D2E_REPO (create from main), never on checked-out mains elsewhere (site/E2D5 changes ride existing conventions: worktree or feature branch as each task states).

---

### Task 1: Parameterize the canonical license client (SITE_REPO + E2D5_REPO)

The canonical `LicenseClient` hardcodes two E2D5-specific values: the admin page URL slug (`edcp-kit`) inside `status_notice()` and the product page URL (`https://divi5lab.com/plugins/elementor-to-divi-5`) inside `inject_update()`. A second consumer makes these constructor parameters.

**Files:**
- Modify (SITE_REPO, on a branch off main): `lib/license-server/php-client/class-license-client.php`
- Modify (SITE_REPO): `scripts/sync-license-client.sh` (add the D2E Pro destination)
- Modify (E2D5_REPO, branch `chore/client-params` off main): `plugin/jhmg-converter-for-elementor-to-divi-pro/includes/class-plugin.php` (pass the two new ctor args)
- Test (E2D5_REPO): `tests/LicenseClientTest.php` (constructor call sites updated; add one assertion that the injected update's `url` uses the passed product URL)

**Interfaces:**
- Produces — new constructor (all consumers must pass all six):

```php
public function __construct(
    private string $product,
    private string $plugin_version,
    private string $api_base,
    private string $plugin_basename,
    private string $admin_page_slug,   // e.g. 'edcp-kit' — used in status_notice() links
    private string $product_page_url   // e.g. 'https://divi5lab.com/plugins/elementor-to-divi-5' — used as the update entry's `url` and in renew links
) {}
```

- [ ] **Step 1 (TDD, E2D5_REPO):** update `tests/LicenseClientTest.php`'s `setUp` constructor call to pass `'edcp-kit'` and `'https://divi5lab.com/plugins/elementor-to-divi-5'`; add to the licensed-update test: `$this->assertSame( 'https://divi5lab.com/plugins/elementor-to-divi-5', $entry->url );`. Run → FAIL (ctor arity).
- [ ] **Step 2:** edit the CANONICAL file: add the two ctor params; replace the hardcoded `tools.php?page=edcp-kit` in `status_notice()` with `admin_url( 'tools.php?page=' . $this->admin_page_slug )`; replace the hardcoded product URL in `inject_update()`'s entry `url` (and any renew-link in notices) with `$this->product_page_url`. Update the header comment: "constructor-parameterized per product; see sync script for consumers."
- [ ] **Step 3:** extend `scripts/sync-license-client.sh`:

```bash
DEST_D2E="/Users/Lucas/Documents/JHMG-Local/jhmg-divi-to-elementor/plugin/jhmg-converter-divi-to-elementor-pro/includes/licensing/class-license-client.php"
mkdir -p "$(dirname "$DEST_D2E")"
cp "$SRC" "$DEST_D2E"
echo "synced -> $DEST_D2E"
```

Run it (both destinations sync; the D2E Pro dir may not exist yet — mkdir handles it).
- [ ] **Step 4 (E2D5_REPO):** update `includes/class-plugin.php`'s `new Licensing\LicenseClient(...)` to pass `'edcp-kit'` and `'https://divi5lab.com/plugins/elementor-to-divi-5'`.
- [ ] **Step 5:** `E2D5_REPO vendor/bin/phpunit` → all 321+ green; `diff` canonical vs both synced copies → identical. SITE_REPO: `npm run test` (no TS consumers of the PHP file — expect unchanged green) — commit both repos:

```bash
# SITE_REPO: git commit -m "refactor(licensing): parameterize canonical client (admin slug, product URL) + dual-destination sync"
# E2D5_REPO: git commit -m "chore(pro): pass product params to parameterized license client (synced canonical)"
```

(Note: this changes E2D5 Pro code with no behavior delta for buyers — it rides along with the NEXT E2D5 Pro release; do not publish a release now. Merge E2D5 branch to its main after the suite is green.)

---

### Task 2: WP-stub test bootstrap for D2E_REPO (port from sibling)

D2E's `tests/bootstrap.php` has NO WP stubs (pure parser/builder unit tests). Port the sibling's stub layer so seam/admin/licensing tests can run.

**Files:**
- Modify (D2E_REPO, branch `feat/pro-split` off main): `tests/bootstrap.php`
- Test: `tests/FilterStubTest.php` (new)

**Interfaces:**
- Produces: the full stub set from `E2D5_REPO/tests/bootstrap.php` — filter/action registry (`add_filter`/`apply_filters`/`do_action`/`add_action` + reset helper), options/transients in-memory stores, post stubs, `WP_Error`, HTTP-queue stubs (`wp_remote_post/get` + `edc_test_http_queue`-equivalent), misc (`esc_html*`, `wp_json_encode`, `plugin_basename`, `home_url`, `admin_url`, `DAY_IN_SECONDS`…). Rename the test helpers to `jhmg_test_reset_hooks()` / `jhmg_test_http_queue()` / `$GLOBALS['jhmg_test_hooks']` / `$GLOBALS['jhmg_test_http']` — this repo has no `edc_` heritage.

- [ ] **Step 1:** copy `tests/FilterStubTest.php` from the sibling, rename helpers to `jhmg_test_*`, and use D2E hook names in the assertions (`jhmgcofo_pro_active`, `jhmgcofo_loaded`). Run → FAIL.
- [ ] **Step 2:** port the sibling's bootstrap stub blocks into D2E's `tests/bootstrap.php` (KEEP its existing autoloader + `ABSPATH` lines; add only missing stubs, all `function_exists`-guarded; rename globals/helpers per the interface). Do NOT require the plugin main file if the current bootstrap doesn't (check — if the 45 unit tests construct classes directly via composer autoload, keep it that way and require the plugin bootstrap only if a later test needs `Plugin::instance()`; document the choice in the file).
- [ ] **Step 3:** `vendor/bin/phpunit` → 45 existing + 4 new green. Commit: `test: WP stub layer with filter/action registry (ported from sibling repo)`.

---

### Task 3: Free-plugin extension seams (D2E_REPO)

Add the seams while ALL features still exist (trims happen in Task 6, after Pro has copied the code in Task 5).

**Files:**
- Modify: `plugin/jhmg-converter-divi-to-elementor/includes/converter/class-elementor-builder.php` (`convert_module()` ~:344-367)
- Modify: `plugin/jhmg-converter-divi-to-elementor/includes/admin/class-batch-importer.php` (`import()` ~:29-51)
- Modify: `plugin/jhmg-converter-divi-to-elementor/includes/helpers/class-plugin.php` (`register_hooks()` ~:24-31)
- Test: `tests/SeamsTest.php` (new)

**Interfaces:**
- Produces (the seam contract Tasks 4-6 rely on):
  - `apply_filters( 'jhmgcofo_pro_active', false ): bool`
  - `apply_filters( 'jhmgcofo_convert_module', null, array $node ): ?array` — first crack at converting a Divi module node; a non-null return is used as the Elementor widget array verbatim (Pro answers for `wc_*` etc.); null falls through to the built-in map.
  - `apply_filters( 'jhmgcofo_max_layouts', 1 ): int` — cap on layouts converted per import run (free default 1; Pro returns `PHP_INT_MAX`). When layouts are skipped, each result set gains a report warning naming the count and the Pro URL.
  - `do_action( 'jhmgcofo_loaded', \DiviElementorConverter\Plugin $plugin )` at the end of `register_hooks()`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/SeamsTest.php
use PHPUnit\Framework\TestCase;
use DiviElementorConverter\Converter\ElementorBuilder;
use DiviElementorConverter\Admin\BatchImporter;

class SeamsTest extends TestCase {
    protected function setUp(): void { jhmg_test_reset_hooks(); }

    public function test_convert_module_filter_short_circuits(): void {
        add_filter( 'jhmgcofo_convert_module', function ( $v, $node ) {
            return $node['tag'] === 'wc_price'
                ? [ 'id' => 'x1', 'elType' => 'widget', 'widgetType' => 'woocommerce-product-price', 'settings' => [] ]
                : $v;
        }, 10, 2 );
        $builder = new ElementorBuilder();
        // build() a minimal layout containing a wc_price module — read tests/ElementorBuilderTest.php
        // for the exact node-shape fixtures this repo uses and construct the same way.
        $out = $builder->build( /* minimal section>row>wc_price node tree per existing fixtures */ );
        $json = json_encode( $out );
        $this->assertStringContainsString( 'woocommerce-product-price', $json );
    }

    public function test_max_layouts_filter_caps_import_and_reports(): void {
        // Two-layout input; default filter (1) => one post + a warning naming Pro.
        $importer = new BatchImporter();
        $results  = $importer->import( /* two-layout parsed fixture per DiviParserTest's shapes */ );
        $this->assertCount( 1, $results );
        $this->assertStringContainsString( 'divi5lab.com/plugins/divi-to-elementor', json_encode( $results ) );
    }

    public function test_max_layouts_uncapped_when_filtered(): void {
        add_filter( 'jhmgcofo_max_layouts', fn() => PHP_INT_MAX );
        $importer = new BatchImporter();
        $results  = $importer->import( /* same two-layout fixture */ );
        $this->assertCount( 2, $results );
    }

    public function test_loaded_action_fires(): void {
        $seen = null;
        add_action( 'jhmgcofo_loaded', function ( $p ) use ( &$seen ) { $seen = $p; } );
        \DiviElementorConverter\Plugin::instance()->register_hooks();
        $this->assertNotNull( $seen );
    }
}
```

IMPLEMENTER NOTE (binding): the fixture comments above are NOT placeholders to skip — read `tests/ElementorBuilderTest.php` and `tests/DiviParserTest.php` first and build real minimal fixtures in their established node shapes. `BatchImporter::import()`'s signature must be read before writing the test (recon says `import()` takes parsed layouts + options ~:29-51 — match reality). `is_admin()` stubs false, so `register_hooks()` skips AdminPage — safe to call in tests.

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.**

`class-elementor-builder.php` `convert_module()` — at the top, before the WIDGET_MAP lookup:

```php
        if ( function_exists( 'apply_filters' ) ) {
            $intercepted = apply_filters( 'jhmgcofo_convert_module', null, $node );
            if ( is_array( $intercepted ) ) {
                return $intercepted;
            }
        }
```

`class-batch-importer.php` `import()` — after parsing, before the per-layout loop:

```php
        $max = function_exists( 'apply_filters' ) ? (int) apply_filters( 'jhmgcofo_max_layouts', 1 ) : 1;
        $skipped = max( 0, count( $layouts ) - $max );
        $layouts = array_slice( $layouts, 0, $max );
```

and after the loop, when `$skipped > 0`, append to the last result's report warnings (match the exact report key `render_batch_result()` renders — read it first):

```php
            $results[ array_key_last( $results ) ]['report']['warnings'][] = sprintf(
                'This export contains %d more layout(s). The Pro add-on converts every layout in one run — https://divi5lab.com/plugins/divi-to-elementor?utm_source=plugin&utm_medium=upsell',
                $skipped
            );
```

`class-plugin.php` `register_hooks()` — append `do_action( 'jhmgcofo_loaded', $this );`.

NOTE: the default cap changes free behavior for multi-layout files ALREADY in this task — that is intended (the trim boundary), and the existing 45 unit tests don't exercise `BatchImporter` (they cover parser/builder), so nothing else breaks. Verify that claim by running the suite.

- [ ] **Step 4:** full suite green + `php -l` sweep. Commit: `feat(free): extension seams — convert-module/max-layouts filters, pro-active, loaded action`.

---

### Task 4: Pro plugin scaffold (D2E_REPO)

**Files:**
- Create: `plugin/jhmg-converter-divi-to-elementor-pro/jhmg-converter-divi-to-elementor-pro.php`
- Create: `plugin/jhmg-converter-divi-to-elementor-pro/includes/class-autoloader.php`
- Create: `plugin/jhmg-converter-divi-to-elementor-pro/includes/class-plugin.php`
- Create: `plugin/jhmg-converter-divi-to-elementor-pro/uninstall.php`
- Modify: `composer.json` (PSR-4 `"DiviElementorConverter\\Pro\\": "plugin/jhmg-converter-divi-to-elementor-pro/includes/"` + `composer dump-autoload`, COMMIT the regenerated `vendor/composer/*` if vendor is tracked in this repo — check `git ls-files vendor | head` first; if vendor is untracked, don't force-add)
- Modify: `tests/bootstrap.php` (require the Pro main file — with the same guard style as whatever the free plugin gets)
- Test: `tests/ProPluginTest.php`

**Interfaces:**
- Produces: `\DiviElementorConverter\Pro\Plugin::instance()->init()`; constants `JHMGCOFOP_PLUGIN_FILE/_DIR/_URL/_VERSION ('1.0.0')`, `JHMGCOFOP_PRODUCT_SLUG = 'divi-to-elementor-pro'`, `JHMGCOFOP_API_BASE` (default `https://divi5lab.com`, `defined()||` overridable). `register_hooks()` (plugins_loaded priority 20): free-plugin guard (`class_exists( \DiviElementorConverter\Plugin::class )` else admin notice + return), then `add_filter( 'jhmgcofo_pro_active', '__return_true' )`. Header `Requires Plugins: jhmg-converter-divi-to-elementor` (best guess at the pending wp.org slug — the submitted zip's directory name; REVISIT at launch when the real slug is known) + `Requires Plugins: elementor` stays on the FREE plugin only.

Main file / autoloader / Plugin / uninstall: mirror the E2D5 Pro scaffold exactly (read `E2D5_REPO/plugin/jhmg-converter-for-elementor-to-divi-pro/` files and transliterate: `EDCP_`→`JHMGCOFOP_`, `ElementorDivi5Converter\Pro`→`DiviElementorConverter\Pro`, text domain `jhmg-converter-divi-to-elementor-pro`, plugin name `JHMG Converter For Divi to Elementor — Pro`, description "Pro add-on: batch conversion, WooCommerce widget mapping, and Divi Theme Builder import."). `uninstall.php` deletes `jhmgcofop_license_key`, `jhmgcofop_license_state`, `jhmgcofop_update_blocked`.

- [ ] **Step 1 (TDD):** `tests/ProPluginTest.php` — mirror the sibling's: Pro Plugin class exists, `register_hooks()` makes `apply_filters('jhmgcofo_pro_active', false)` true, constants equal `divi-to-elementor-pro` / `1.0.0`. Run → FAIL.
- [ ] **Step 2:** implement per the interface. `composer dump-autoload`. Add any missing bootstrap stubs the Pro main file needs.
- [ ] **Step 3:** full suite + `php -l` green. Commit: `feat(pro): plugin scaffold — autoloader, dependency guard, jhmgcofo_pro_active`.

---

### Task 5: Pro features — Woo mapping, uncapped batch, Theme Builder import, Pro admin page (D2E_REPO)

COPY (not delete) the premium-bound code into Pro and wire the seams. Free still contains everything until Task 6.

**Files:**
- Create: `.../divi-to-elementor-pro/includes/converter/class-woo-modules.php` — the 11 `wc_*` mappings extracted from free's `class-elementor-builder.php` `WIDGET_MAP:63-74` + their `widget_settings` switch cases (~:875-888), exposed as a `jhmgcofo_convert_module` filter callback: given a node whose tag is in its map, return the full Elementor widget array (id via the same id-generation helper free uses — read how `convert_module` builds widget arrays and replicate; `wc_cart_notice` returns the `html` widget with the `[woocommerce_cart]` shortcode).
- Create: `.../divi-to-elementor-pro/includes/converter/class-theme-builder-importer.php` — ports free's dead `includes/converter/class-converter.php::convert_theme_builder()` (~:32-73) + `DiviParser::parse_theme_builder_layouts()` (~:160-208) into one Pro class: `import( string $json ): array` → for each role (header/footer/body) creates an `elementor_library` post with the converted content and the honest `_elementor_template_type` ('wp-page', keeping the existing code's comment that real template-type assignment needs Elementor Pro on the site).
- Create: `.../divi-to-elementor-pro/includes/admin/class-pro-page.php` — Tools submenu 'Divi → Elementor Pro', slug `jhmgcofop-converter`, cap `manage_options`; multi-file upload form (`multiple` input, name `jhmgcofop_import_files[]`), accepts et_builder/et_builder_layouts AND et_theme_builder JSON; POST action `jhmgcofop_import`, nonce action/name `jhmgcofop_import`/`jhmgcofop_import_nonce`; GET dispatcher param `jhmgcofop_action`, publish nonce `jhmgcofop_publish_<id>`; results in transient `jhmgcofop_batch_<uuid>` (1h); batch-result rendering ported from free's `render_batch_result` (~:336) with identifiers swapped. Page-scoped `handle_post` (checks `$_GET['page']`/request target — belt and braces per Phase 2).
- Modify: Pro `includes/class-plugin.php` `register_hooks()` — wire:

```php
        add_filter( 'jhmgcofo_convert_module', [ new Converter\WooModules(), 'maybe_convert' ], 10, 2 );
        add_filter( 'jhmgcofo_max_layouts', static fn () => PHP_INT_MAX );
        if ( is_admin() ) {
            ( new Admin\ProPage() )->init();
        }
```
- Test: `tests/ProFeaturesTest.php` — (a) with Pro hooks registered, a `wc_price` node converts to `woocommerce-product-price` through the FREE builder (proves the seam end-to-end); (b) two-layout import produces 2 posts; (c) `ThemeBuilderImporter::import()` on a minimal et_theme_builder fixture creates `elementor_library` posts for header+footer with `_elementor_data` set (use the post stubs from Task 2). Build fixtures from the shapes in `tests/DiviParserTest.php`.

- [ ] **Step 1: TDD** — write `tests/ProFeaturesTest.php` → RED.
- [ ] **Step 2:** implement per Files (copy + renamespace; keep free untouched).
- [ ] **Step 3:** full suite + `php -l` green; grep Pro page source for free dispatch identifiers (`jhmgcofo_import`, `jhmgcofo_action`, `jhmgcofo_publish_`) — must be zero hits (add this as a test assertion in ProFeaturesTest, mirroring Phase 2's collision-guard test).
- [ ] **Step 4:** Commit: `feat(pro): woo mapping, uncapped batch, theme-builder import, pro admin page (jhmgcofop_* dispatch)`.

---

### Task 6: Free-plugin trim + readme walk-back + upsell (D2E_REPO)

**Files:**
- Modify: free `includes/converter/class-elementor-builder.php` — DELETE the 11 `wc_*` entries from `WIDGET_MAP` (:63-74) and their `widget_settings` cases (~:875-888). In `convert_module`'s unknown-tag fallback, when `str_starts_with( $tag, 'wc_' )`, add a report warning: `'WooCommerce module "<tag>" requires the Pro add-on — https://divi5lab.com/plugins/divi-to-elementor?utm_source=plugin&utm_medium=upsell'` and skip the module (match how the builder currently records skipped/unsupported items — read the report plumbing first).
- Modify: free `includes/parsers` is N/A — DELETE `DiviParser::parse_theme_builder_layouts()` (:160-208) and the `et_theme_builder` branches in `parse_json` (:30-37) / `parse_layouts` (:111-141): free now REJECTS et_theme_builder JSON — `parse_json` throws the parser's established exception type with message "Theme Builder exports require the Pro add-on".
- Delete: free `includes/converter/class-converter.php` (dead code, now lives in Pro).
- Modify: free `includes/admin/class-admin-page.php` — single-file input (drop `multiple` + `[]` at ~:297); `handle_import` processes exactly one file (reject multi with an error notice); catch the TB rejection and render it as an error notice with the upsell link; `render_sidebar` (~:240): ADD a "Go Pro — $49/yr" card (feature bullets: batch conversion, WooCommerce widgets, Theme Builder import; link with utm) above the existing cross-promo; KEEP the PayPal donate (Lucas's existing choice — do not remove without instruction).
- Modify: free `readme.txt` — walk back to the trimmed story (single JSON file, first layout, 35+ modules, conversion reports; Pro add-on paragraph for batch/Woo/TB with the divi5lab URL; FAQ answers for multi-layout and TB now point at Pro). Fix lines :19, :23-24, :29, :41, :75, :77-79, :85-87, changelog :102-105. Keep `Stable tag: 1.0.0` for now — version strategy decided at launch (Task 8).
- Test: `tests/FreeTrimTest.php` — greps: no `wc_` entry in the builder's WIDGET_MAP source, no `parse_theme_builder_layouts` in free, `class-converter.php` absent; behavior: converting a fixture with a `wc_price` module yields no `woocommerce-` widget and a report warning containing `divi-to-elementor?utm`; `parse_json` on an et_theme_builder fixture throws with "Pro add-on"; ProFeaturesTest still green (Pro path unaffected).

- [ ] **Step 1: TDD** — write `tests/FreeTrimTest.php` → RED.
- [ ] **Step 2:** perform the trim per Files.
- [ ] **Step 3:** full suite + `php -l` green (existing DiviParserTest cases that exercised TB parsing move to Pro's suite or are rewritten against the Pro importer — never silently deleted; adapt with the same assertions).
- [ ] **Step 4:** Commit: `feat(free)!: trim to single-file/single-layout (guideline 5) — woo/batch/theme-builder now Pro; readme walk-back`.

---

### Task 7: License client integration in Pro (D2E_REPO)

**Files:**
- Created by sync (already on disk from Task 1's script run; verify byte-identity): `.../divi-to-elementor-pro/includes/licensing/class-license-client.php`
- Create: `.../divi-to-elementor-pro/includes/licensing/class-license-page.php` — License tab on the Pro page (port the E2D5 Pro `class-license-page.php`, identifiers → `jhmgcofop_save_license` action, nonce `jhmgcofop_license`, field `jhmgcofop_license_key`; options `jhmgcofop_license_key/_state/_update_blocked` — WAIT: the canonical client hardcodes option names `edcp_*`… CHECK the canonical: if option keys are `edcp_*` constants inside the client, they collide across plugins on the same site (both Pros would share `edcp_license_key`!). If so, FIRST extend Task 1's parameterization: option PREFIX becomes a 7th ctor arg (`'edcp'` for E2D5, `'jhmgcofop'` for D2E), keys derived `"{$prefix}_license_key"` etc.; re-sync; update E2D5 wiring + its uninstall; then proceed. This check is BINDING — two license clients storing state in the same option key is a real cross-plugin bug.)
- Modify: Pro `includes/class-plugin.php` — construct the client:

```php
        $license = new Licensing\LicenseClient(
            JHMGCOFOP_PRODUCT_SLUG,
            JHMGCOFOP_PLUGIN_VERSION,
            JHMGCOFOP_API_BASE,
            plugin_basename( JHMGCOFOP_PLUGIN_FILE ),
            'jhmgcofop-converter',
            'https://divi5lab.com/plugins/divi-to-elementor'
            /* + option prefix arg if added: 'jhmgcofop' */
        );
        add_filter( 'pre_set_site_transient_update_plugins', [ $license, 'inject_update' ] );
        if ( is_admin() ) {
            add_action( 'admin_init', function () use ( $license ) { $license->refresh(); } );
            add_action( 'admin_notices', [ new Licensing\LicensePage( $license ), 'maybe_render_notice' ] );
        }
```
- Test: `tests/D2ELicenseClientTest.php` — port the sibling's 6 LicenseClientTest cases with D2E values (product `divi-to-elementor-pro`, basename `jhmg-converter-divi-to-elementor-pro/jhmg-converter-divi-to-elementor-pro.php`, the D2E product URL asserted in the update entry) using the `jhmg_test_http_queue` stubs.

- [ ] **Step 1:** the option-prefix check (see Files note) — resolve it FIRST, including canonical edit + resync + sibling updates if needed (report what you found either way).
- [ ] **Step 2: TDD** — port the test file → RED → implement wiring + LicensePage → GREEN.
- [ ] **Step 3:** byte-identity check canonical vs BOTH synced copies; E2D5 suite re-run if the canonical changed. Full D2E suite + `php -l` green.
- [ ] **Step 4:** Commit: `feat(pro): license client wired (parameterized canonical) — soft enforcement, WP-native updates`.

---

### Task 8: Live e2e + launch runbook (operator-assisted; controller drives)

- [ ] **Step 1:** docker env: `cd D2E_REPO && docker compose up -d` (port 8001; compose mounts only the free plugin — add the Pro plugin mount + `WORDPRESS_CONFIG_EXTRA` defining `JHMGCOFOP_API_BASE 'http://host.docker.internal:3100'`, mirroring the sibling's compose change; commit).
- [ ] **Step 2:** site dev server :3100; mint a dev license: `npx tsx scripts/mint-dev-license.ts --email e2e-d2e@divi5lab-test.com --product divi-to-elementor-pro`.
- [ ] **Step 3:** walk the funnel with evidence (screenshots + curl output): both plugins activate w/o fatals; FREE page: single-file import works, a multi-layout file converts 1 + upsell warning, a TB file errors with upsell, a Woo-module file skips with upsell; PRO page: multi-file batch converts all layouts, TB file → elementor_library posts, wc_price → woocommerce-product-price in `_elementor_data`; license tab: activate (row lands in local DB), status active; publish a local `1.0.1` release for `divi-to-elementor-pro` via `release-plugin.ts` → wp-admin Updates shows it (don't install — bind mount).
- [ ] **Step 4:** write `D2E_REPO/docs/launch-runbook.md`: ON WP.ORG APPROVAL → ① confirm the real slug; fix Pro's `Requires Plugins` header if it differs ② first SVN commit = the TRIMMED free plugin (assets from `assets/`), version as `1.0.0` if wp.org never published the fat zip, else `1.1.0` ③ publish Pro 1.0.0 to prod (`release-plugin.ts` + `.env.prod`) ④ SITE flip: D2E page → BuyProButton (`product="divi-to-elementor-pro"`, drop the pending banner, keep the waitlist as a secondary "get launch news"), pricing card 2 → buyable, plugins hub chip → "Free on wordpress.org · Pro $49/yr" ⑤ email the `divi_to_elementor_waitlist` list via Loops ⑥ verify live checkout returns cs_live for the D2E product. Each step operator-confirmed.
- [ ] **Step 5:** merge `feat/pro-split` → D2E main + push (GitHub only — no deploy semantics in that repo).

---

## Out of scope

- The actual wp.org SVN first release + site flip + waitlist email (launch runbook, gated on approval — Lucas triggers).
- Elementor-Pro-native Theme Builder template-type assignment (current honest behavior: elementor_library posts; revisit post-launch).
- Divi dynamic-content → Elementor dynamic tags; global styles mapping (candidate Pro v1.1 features).
- E2D5 Pro 1.0.1 release carrying the parameterized client (rides with its next update).
