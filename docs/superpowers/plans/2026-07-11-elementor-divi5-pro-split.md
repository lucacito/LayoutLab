# Elementor→Divi 5 Free/Pro Split Implementation Plan (Pivot Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Elementor→Divi 5 converter into a wp.org-compliant free plugin (2.1.0) and a paid Pro companion plugin (1.0.0) wired to divi5lab's live license API, with a minimal buy page so the funnel is revenue-capable end to end.

**Architecture:** The free plugin gains four extension seams (`edc_loaded` action; `edc_pro_active`, `edc_kit_globals`, `edc_theme_builder_exporter` filters) and loses all premium code. The Pro plugin (new sibling folder, namespace `ElementorDivi5Converter\Pro\`) receives the moved premium classes, hooks the seams, owns its own Tools submenu (Kit tools + License), and ships a `LicenseClient` that activates/validates against divi5lab and injects WP-native updates via `/api/plugin/update-check`. **Soft enforcement** (Lucas, 2026-07-11): Pro features always work once installed; license state gates update delivery and drives notices only.

**Tech Stack:** PHP 8.0+ (WP 5.9+), PHPUnit 13 with the repo's hand-rolled WP stubs, wp.org SVN (manual), Next.js/React/Vitest (layoutlab buy page), the live license API on divi5lab.com.

**Repos:**
- `PLUGIN_REPO` = `/Users/Lucas/Documents/JHMG-Local/jhmg-elementor-to-divi5` — free plugin at `plugin/jhmg-converter-for-elementor-to-divi/`, Pro plugin (new) at `plugin/jhmg-converter-for-elementor-to-divi-pro/`. PHP tests: `vendor/bin/phpunit` (bootstrap `tests/bootstrap.php`; composer PSR-4 maps `ElementorDivi5Converter\` → the free plugin's `includes/`).
- `SITE_REPO` = `/Users/Lucas/Documents/JHMG-Local/layoutlab` — canonical license-client copy, buy page. Tests: `npx vitest run <file>`.

Each task names its repo. Commit in the repo you changed.

## Global Constraints

- Product slug is exactly `elementor-to-divi5-pro` everywhere (API calls, checkout, constants).
- License API base: `https://divi5lab.com` (live now). Wire params snake_case: `{ key, site_url, product, plugin_version?, wp_version? }`. Error codes are a FROZEN contract: `invalid_key`, `product_mismatch`, `license_not_usable`, `rate_limited`, `invalid_request`.
- **Soft enforcement:** Pro features never lock. License state affects updates + admin notices only.
- **wp.org guideline 5:** the free 2.1.0 zip must contain NO premium feature code (moved, not flag-gated). Upsell UI (links, comparison tables) stays — links only, no fake activation.
- Namespaces/prefixes: free = `ElementorDivi5Converter\` / `EDC_` / options `edc_*`; Pro = `ElementorDivi5Converter\Pro\` / `EDCP_` / options `edcp_*`.
- Neither plugin may fatal when the other is absent: free degrades gracefully (filters return defaults); Pro guards on `class_exists( \ElementorDivi5Converter\Plugin::class )` and shows a notice.
- Versions: free `2.1.0`, Pro `1.0.0`. PHP `8.0`, WP `5.9` floors (match existing headers).
- Client cadence: validate cache 24h (`DAY_IN_SECONDS`), offline grace 72h (`3 * DAY_IN_SECONDS`) keeping last-known state.
- Buy page price copy: **$49/yr, unlimited sites** (matches the live Stripe price).
- All PHP files start with the `if ( ! defined( 'ABSPATH' ) ) { exit; }` guard (Pro main file uses `defined( 'ABSPATH' ) || exit;`). Follow the existing code style (tabs/spacing as in neighboring files).
- Run the full PHP suite (`vendor/bin/phpunit`) before each plugin-repo commit; `npx vitest run` + `npm run typecheck` before each layoutlab commit.

---

### Task 1: Upgrade the PHP test bootstrap — real filter/action registry (PLUGIN_REPO)

The current stubs make `add_filter` a no-op and `apply_filters` a passthrough (`tests/bootstrap.php:20-35`), so seam behavior can't be tested. Replace them with a minimal registry. Backward compatible: no existing test registers filters.

**Files:**
- Modify: `tests/bootstrap.php` (the `add_action`/`add_filter`/`apply_filters`/`do_action` stubs near lines 20–40)
- Test: `tests/FilterStubTest.php` (new)

**Interfaces:**
- Produces: working `add_filter`/`apply_filters`/`do_action`/`add_action` + `edc_test_reset_hooks()` used by every later PHP test.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/FilterStubTest.php
use PHPUnit\Framework\TestCase;

class FilterStubTest extends TestCase {
    protected function setUp(): void { edc_test_reset_hooks(); }

    public function test_apply_filters_passthrough_when_no_filter(): void {
        $this->assertNull( apply_filters( 'edc_kit_globals', null ) );
        $this->assertFalse( apply_filters( 'edc_pro_active', false ) );
    }

    public function test_registered_filter_transforms_value(): void {
        add_filter( 'edc_pro_active', fn( $v ) => true );
        $this->assertTrue( apply_filters( 'edc_pro_active', false ) );
    }

    public function test_filter_receives_extra_args(): void {
        add_filter( 'edc_x', fn( $v, $extra ) => $v . $extra, 10, 2 );
        $this->assertSame( 'ab', apply_filters( 'edc_x', 'a', 'b' ) );
    }

    public function test_do_action_invokes_callbacks(): void {
        $called = null;
        add_action( 'edc_loaded', function ( $arg ) use ( &$called ) { $called = $arg; } );
        do_action( 'edc_loaded', 'plugin-instance' );
        $this->assertSame( 'plugin-instance', $called );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "$PLUGIN_REPO" && vendor/bin/phpunit --filter FilterStubTest`
Expected: FAIL — `edc_test_reset_hooks` undefined, and/or the registered filter has no effect.

- [ ] **Step 3: Implement the registry in `tests/bootstrap.php`**

Replace the existing `add_action`/`add_filter`/`apply_filters` stubs (keep their `function_exists` guards) and add `do_action`/`edc_test_reset_hooks`:

```php
$GLOBALS['edc_test_hooks'] = [];

if ( ! function_exists( 'edc_test_reset_hooks' ) ) {
    function edc_test_reset_hooks() { $GLOBALS['edc_test_hooks'] = []; }
}

if ( ! function_exists( 'add_filter' ) ) {
    function add_filter( $tag, $callback, $priority = 10, $accepted_args = 1 ) {
        $GLOBALS['edc_test_hooks'][ $tag ][] = [ 'cb' => $callback, 'args' => $accepted_args ];
        return true;
    }
}

if ( ! function_exists( 'add_action' ) ) {
    function add_action( $tag, $callback, $priority = 10, $accepted_args = 1 ) {
        return add_filter( $tag, $callback, $priority, $accepted_args );
    }
}

if ( ! function_exists( 'apply_filters' ) ) {
    function apply_filters( $tag, $value, ...$args ) {
        foreach ( $GLOBALS['edc_test_hooks'][ $tag ] ?? [] as $entry ) {
            $value = call_user_func_array( $entry['cb'], array_slice( array_merge( [ $value ], $args ), 0, max( 1, $entry['args'] ) ) );
        }
        return $value;
    }
}

if ( ! function_exists( 'do_action' ) ) {
    function do_action( $tag, ...$args ) {
        foreach ( $GLOBALS['edc_test_hooks'][ $tag ] ?? [] as $entry ) {
            call_user_func_array( $entry['cb'], array_slice( $args, 0, max( 1, $entry['args'] ) ) );
        }
    }
}
```

Important: the plugin bootstrap is required at the END of `tests/bootstrap.php` (line ~294) — it registers real hooks into this registry once; `edc_test_reset_hooks()` in each test's `setUp` clears them, which is fine because tests construct objects directly.

- [ ] **Step 4: Run the new test AND the full suite**

Run: `vendor/bin/phpunit --filter FilterStubTest` → PASS (4 tests)
Run: `vendor/bin/phpunit` → all 277+ existing tests still pass (registry is behavior-compatible: nothing registered → passthrough).

- [ ] **Step 5: Commit**

```bash
git add tests/bootstrap.php tests/FilterStubTest.php
git commit -m "test: real filter/action registry in WP stubs (for free/Pro seams)"
```

---

### Task 2: Free-plugin extension seams (PLUGIN_REPO)

Decouple free core from premium classes via filters; add the `edc_loaded` action. Premium classes still exist in free after this task (they move in Task 5) — this task only reroutes the references.

**Files:**
- Modify: `plugin/jhmg-converter-for-elementor-to-divi/includes/stylemapper/class-globals-resolver.php` (remove `use ...\Premium\GlobalsStore` at :5; rewrite `resolveColor`/`resolveTypography` at :156-178)
- Modify: `plugin/jhmg-converter-for-elementor-to-divi/includes/admin/class-batch-importer.php` (constructor :27-40, template routing :95-115, `importHeaderTemplate`/`importFooterTemplate`)
- Modify: `plugin/jhmg-converter-for-elementor-to-divi/includes/helpers/class-plugin.php` (`register_hooks` :25-31)
- Test: `tests/SeamsTest.php` (new)

**Interfaces:**
- Produces (the seam contract Tasks 3–5 rely on):
  - `apply_filters( 'edc_kit_globals', null ): ?array` — kit colors/typography or null
  - `apply_filters( 'edc_theme_builder_exporter', null ): ?object` — an object with `saveHeader(string, array): array` and `saveFooter(string, array): array`, or null
  - `apply_filters( 'edc_pro_active', false ): bool`
  - `do_action( 'edc_loaded', \ElementorDivi5Converter\Plugin $plugin )` fired on `plugins_loaded` after free hooks register

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/SeamsTest.php
use PHPUnit\Framework\TestCase;
use ElementorDivi5Converter\StyleMapper\GlobalsResolver;
use ElementorDivi5Converter\Admin\BatchImporter;

class SeamsTest extends TestCase {
    protected function setUp(): void { edc_test_reset_hooks(); }

    public function test_globals_resolver_uses_kit_globals_filter(): void {
        add_filter( 'edc_kit_globals', fn( $v ) => [ 'colors' => [ 'abc123' => '#ff0000' ], 'typography' => [] ] );
        $this->assertSame( '#ff0000', GlobalsResolver::resolveColor( 'abc123' ) );
    }

    public function test_globals_resolver_falls_back_to_static_map_without_filter(): void {
        // 'f8733ea' is in the static TYPOGRAPHY_MAP; no filter registered.
        $t = GlobalsResolver::resolveTypography( 'f8733ea' );
        $this->assertIsArray( $t );
        $this->assertSame( 'Roboto', $t['family'] );
    }

    public function test_batch_importer_degrades_header_to_page_without_exporter(): void {
        $importer = new BatchImporter(); // no exporter filter registered -> null
        $results  = $importer->import(
            [ [ 'title' => 'My Header', 'template_type' => 'header', 'elements' => [] ] ],
            [ 'post_type' => 'page', 'post_status' => 'draft', 'convert_headers' => true, 'convert_footers' => true ]
        );
        $this->assertCount( 1, $results );
        $this->assertTrue( $results[0]['success'] );
        $this->assertStringContainsString( 'Pro', implode( ' ', $results[0]['report']['warnings'] ?? [] ) );
    }

    public function test_batch_importer_uses_exporter_from_filter(): void {
        $fake = new class {
            public array $calls = [];
            public function saveHeader( string $t, array $c ): array {
                $this->calls[] = 'header';
                return [ 'post_id' => 1, 'template_id' => 2, 'theme_builder_id' => 3, 'success' => true, 'error' => '' ];
            }
            public function saveFooter( string $t, array $c ): array {
                $this->calls[] = 'footer';
                return [ 'post_id' => 1, 'template_id' => 2, 'theme_builder_id' => 3, 'success' => true, 'error' => '' ];
            }
        };
        add_filter( 'edc_theme_builder_exporter', fn( $v ) => $fake );
        $importer = new BatchImporter();
        $importer->import(
            [ [ 'title' => 'H', 'template_type' => 'header', 'elements' => [] ] ],
            [ 'post_type' => 'page', 'post_status' => 'draft', 'convert_headers' => true, 'convert_footers' => false ]
        );
        $this->assertSame( [ 'header' ], $fake->calls );
    }
}
```

NOTE for the implementer: read `BatchImporter::import()`'s actual signature/options shape first (`class-batch-importer.php` around :80-115) and adapt the test's option array keys to the real ones (`convert_headers`/`convert_footers` naming comes from admin :140-161 — verify). Same for the report-warnings key: `render_report_cards()` (`class-admin-page.php:789`) reads specific report keys — use the same key it renders as warnings so the message actually shows in the UI. Keep the assertions' substance.

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/phpunit --filter SeamsTest`
Expected: FAIL — resolver still calls `GlobalsStore::load()`; importer type-hints the exporter and never degrades.

- [ ] **Step 3: Implement the seams**

`class-globals-resolver.php` — delete the `use ElementorDivi5Converter\Premium\GlobalsStore;` line and replace the two lookup heads:

```php
    /** Kit globals supplied by the Pro add-on (null when Pro absent). */
    private static function kitGlobals(): ?array {
        if ( ! function_exists( 'apply_filters' ) ) {
            return null;
        }
        $kit = apply_filters( 'edc_kit_globals', null );
        return is_array( $kit ) ? $kit : null;
    }

    public static function resolveColor( string $id ): ?string {
        $kit = self::kitGlobals();
        if ( $kit !== null && isset( $kit['colors'][ $id ] ) ) {
            return $kit['colors'][ $id ];
        }
        return self::COLOR_MAP[ $id ] ?? null;
    }

    public static function resolveTypography( string $id ): ?array {
        $kit = self::kitGlobals();
        if ( $kit !== null && isset( $kit['typography'][ $id ] ) ) {
            return $kit['typography'][ $id ];
        }
        return self::TYPOGRAPHY_MAP[ $id ] ?? null;
    }
```

`class-batch-importer.php` — remove the `use ...\DiviThemeBuilderExporter;` import; change the property + constructor:

```php
    private ConverterEngine $engine;
    private DiviExporter $exporter;
    /** Theme Builder exporter supplied by the Pro add-on via filter (null when absent). */
    private ?object $themeBuilderExporter;

    public function __construct(
        ?ConverterEngine $engine = null,
        ?DiviExporter $exporter = null,
        ?object $themeBuilderExporter = null
    ) {
        $this->engine   = $engine   ?? new ConverterEngine();
        $this->exporter = $exporter ?? new DiviExporter();
        $this->themeBuilderExporter = $themeBuilderExporter
            ?? ( function_exists( 'apply_filters' ) ? apply_filters( 'edc_theme_builder_exporter', null ) : null );
        // ... existing global-colors block unchanged
    }
```

In the routing loop (:99-110), guard on the exporter and degrade:

```php
            $wants_theme_builder = ( $template_type === 'header' && $convert_headers )
                || ( $template_type === 'footer' && $convert_footers );

            if ( $wants_theme_builder && $this->themeBuilderExporter === null ) {
                $result = $this->importPageItem( $item, $default_post_type, $default_post_status );
                $result['report']['warnings'][] = 'Theme Builder export for headers/footers requires the Pro add-on — imported as a regular draft instead. Get Pro: https://divi5lab.com/plugins/elementor-to-divi-5';
                $results[] = $result;
                continue;
            }

            if ( $template_type === 'header' && $convert_headers ) {
                $results[] = $this->importHeaderTemplate( $item, $default_post_status );
                continue;
            }
            // footer branch unchanged
```

(Adjust the `report.warnings` key to whatever `render_report_cards()` actually renders — see the note in Step 1.)

`class-plugin.php` `register_hooks()` — append after the existing body:

```php
        // Extension point for the Pro add-on (and future companions).
        do_action( 'edc_loaded', $this );
```

- [ ] **Step 4: Run tests**

Run: `vendor/bin/phpunit --filter SeamsTest` → PASS.
Run: `vendor/bin/phpunit` → full suite green. `tests/HeaderTemplateConversionTest.php` constructs its exporter explicitly or relies on the default — if it breaks because the default is now null, register the filter in its `setUp` with a real `DiviThemeBuilderExporter` (class still exists until Task 5) or pass it via constructor; do NOT weaken its assertions.

- [ ] **Step 5: Commit**

```bash
git add plugin/jhmg-converter-for-elementor-to-divi/includes tests/SeamsTest.php tests/HeaderTemplateConversionTest.php
git commit -m "feat(free): extension seams — kit-globals/theme-builder/pro-active filters + edc_loaded action"
```

---

### Task 3: Pro plugin scaffold (PLUGIN_REPO)

**Files:**
- Create: `plugin/jhmg-converter-for-elementor-to-divi-pro/jhmg-converter-for-elementor-to-divi-pro.php`
- Create: `plugin/jhmg-converter-for-elementor-to-divi-pro/includes/class-autoloader.php`
- Create: `plugin/jhmg-converter-for-elementor-to-divi-pro/includes/class-plugin.php`
- Create: `plugin/jhmg-converter-for-elementor-to-divi-pro/uninstall.php`
- Modify: `composer.json` (add PSR-4 mapping `"ElementorDivi5Converter\\Pro\\": "plugin/jhmg-converter-for-elementor-to-divi-pro/includes/"`, then `composer dump-autoload`)
- Modify: `tests/bootstrap.php` (require the Pro main file after the free one, guarded — see Step 3)
- Test: `tests/ProPluginTest.php`

**Interfaces:**
- Produces: `\ElementorDivi5Converter\Pro\Plugin::instance()->init()`; constants `EDCP_PLUGIN_FILE/_DIR/_URL/_VERSION`, `EDCP_PRODUCT_SLUG = 'elementor-to-divi5-pro'`, `EDCP_API_BASE` (default `https://divi5lab.com`, overridable via prior `define` for dev); Pro registers `edc_pro_active` → true. Tasks 4 & 6 add feature/licensing wiring inside `register_hooks()`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/ProPluginTest.php
use PHPUnit\Framework\TestCase;

class ProPluginTest extends TestCase {
    protected function setUp(): void { edc_test_reset_hooks(); }

    public function test_pro_plugin_class_exists_and_registers_pro_active(): void {
        $pro = \ElementorDivi5Converter\Pro\Plugin::instance();
        $pro->register_hooks();
        $this->assertTrue( apply_filters( 'edc_pro_active', false ) );
    }

    public function test_constants_defined(): void {
        $this->assertSame( 'elementor-to-divi5-pro', EDCP_PRODUCT_SLUG );
        $this->assertSame( '1.0.0', EDCP_PLUGIN_VERSION );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/phpunit --filter ProPluginTest` → FAIL (class not found).

- [ ] **Step 3: Implement the scaffold**

Main file `jhmg-converter-for-elementor-to-divi-pro.php`:

```php
<?php
/**
 * Plugin Name:       JHMG Converter For Elementor to Divi 5 — Pro
 * Description:       Pro add-on: full Elementor kit ZIP import, global headers & footers to the Divi Theme Builder, and global styles.
 * Version:           1.0.0
 * Requires at least: 5.9
 * Requires PHP:      8.0
 * Requires Plugins:  jhmg-converter-for-elementor-to-divi
 * Author:            Lucas Lopvet
 * License:           GPLv2 or later
 * Text Domain:       jhmg-converter-for-elementor-to-divi-pro
 */

defined( 'ABSPATH' ) || exit;

define( 'EDCP_PLUGIN_FILE', __FILE__ );
define( 'EDCP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'EDCP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'EDCP_PLUGIN_VERSION', '1.0.0' );
define( 'EDCP_PRODUCT_SLUG', 'elementor-to-divi5-pro' );
// Overridable for local/dev license servers: define EDCP_API_BASE in wp-config.php.
defined( 'EDCP_API_BASE' ) || define( 'EDCP_API_BASE', 'https://divi5lab.com' );

require_once EDCP_PLUGIN_DIR . 'includes/class-autoloader.php';

\ElementorDivi5Converter\Pro\Plugin::instance()->init();
```

`includes/class-autoloader.php` — copy the free plugin's `includes/helpers/class-autoloader.php` pattern verbatim, adapted: namespace `ElementorDivi5Converter\Pro`, prefix `ElementorDivi5Converter\\Pro\\`, base dir `EDCP_PLUGIN_DIR . 'includes/'`, same class-file naming convention (`class-*.php`, read the free autoloader's exact transform and mirror it).

`includes/class-plugin.php`:

```php
<?php

namespace ElementorDivi5Converter\Pro;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Plugin {
    private static ?Plugin $instance = null;

    public static function instance(): Plugin {
        return self::$instance ??= new self();
    }

    public function init(): void {
        // Priority 20: after the free plugin's own plugins_loaded hook (10).
        add_action( 'plugins_loaded', [ $this, 'register_hooks' ], 20 );
    }

    public function register_hooks(): void {
        if ( ! class_exists( \ElementorDivi5Converter\Plugin::class ) ) {
            add_action( 'admin_notices', [ $this, 'render_missing_free_notice' ] );
            return;
        }

        add_filter( 'edc_pro_active', '__return_true' );
        // Feature wiring (kit globals, theme-builder exporter, admin pages,
        // licensing) is registered here by later tasks.
    }

    public function render_missing_free_notice(): void {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__( 'JHMG Converter Pro requires the free "JHMG Converter For Elementor to Divi 5" plugin. Please install and activate it.', 'jhmg-converter-for-elementor-to-divi-pro' );
        echo '</p></div>';
    }
}
```

`uninstall.php`:

```php
<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}
delete_option( 'edcp_license_key' );
delete_option( 'edcp_license_state' );
delete_option( 'edcp_update_blocked' );
```

`tests/bootstrap.php` — after the existing free-plugin require (~line 294), add:

```php
require_once __DIR__ . '/../plugin/jhmg-converter-for-elementor-to-divi-pro/jhmg-converter-for-elementor-to-divi-pro.php';
```

Check first which WP functions the Pro main file needs stubbed (`plugin_dir_path`, `plugin_dir_url`, `esc_html__`) — add missing stubs next to the existing ones (the free bootstrap already stubs most; add only what PHPUnit reports as undefined).

- [ ] **Step 4: Run tests**

Run: `vendor/bin/phpunit --filter ProPluginTest` → PASS. Full suite → green.
Run: `composer dump-autoload` after editing composer.json.

- [ ] **Step 5: Commit**

```bash
git add plugin/jhmg-converter-for-elementor-to-divi-pro composer.json composer.lock tests/bootstrap.php tests/ProPluginTest.php
git commit -m "feat(pro): plugin scaffold — autoloader, dependency guard, edc_pro_active"
```

---

### Task 4: Move premium features into Pro (PLUGIN_REPO)

COPY (not yet delete — Task 5 deletes from free) the premium classes into Pro, renamespace, and wire the seams. Pro gets its own Tools submenu with the kit tools.

**Files:**
- Create (copied + renamespaced from free):
  - `.../divi-pro/includes/kit/class-globals-store.php` ← free `includes/premium/class-globals-store.php` (namespace → `ElementorDivi5Converter\Pro\Kit`; option key stays `edc_kit_globals` so existing installs keep their kit)
  - `.../divi-pro/includes/kit/class-kit-globals-parser.php` ← free `includes/premium/class-kit-globals-parser.php` (namespace → `ElementorDivi5Converter\Pro\Kit`)
  - `.../divi-pro/includes/exporters/class-divi-theme-builder-exporter.php` ← free `includes/exporters/class-divi-theme-builder-exporter.php` (namespace → `ElementorDivi5Converter\Pro\Exporters`; keep its `use` of the free `DiviExporter` — fully-qualify as `\ElementorDivi5Converter\Exporters\DiviExporter`)
  - `.../divi-pro/includes/admin/class-kit-page.php` ← port from free `includes/admin/class-admin-page.php` the premium pieces: `handle_upload_kit()` (:885-1022), `handle_convert_kit_pages()` (:1025-1129), `handle_clear_kit()` (:1131-1146), `render_global_kit_section()` (:1186-1217), `render_kit_status()` (:1237-1420), `render_kit_upload_form()` (:1421-1491), the kit nonce constants (:19-23), plus the premium "Convert" tab's ZIP handling from `handle_import()`/`render_import_section()` (:104-177 ZIP branch, :553-630)
- Modify: `.../divi-pro/includes/class-plugin.php` (`register_hooks` — wire filters + admin page)
- Test: `tests/ProKitTest.php` (new); Move: `tests/HeaderTemplateConversionTest.php` assertions now target the Pro exporter class

**Interfaces:**
- Consumes: seams from Task 2; free classes `ConverterEngine`, `DiviExporter`, `BatchImporter`, `ElementorImportParser` (referenced fully-qualified from Pro).
- Produces: Pro admin page slug `edcp-kit` under Tools ("Elementor → Divi 5 Pro"); filters wired: `edc_kit_globals` → `GlobalsStore::load()`, `edc_theme_builder_exporter` → `new Pro\Exporters\DiviThemeBuilderExporter()`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/ProKitTest.php
use PHPUnit\Framework\TestCase;
use ElementorDivi5Converter\Pro\Kit\GlobalsStore;
use ElementorDivi5Converter\StyleMapper\GlobalsResolver;

class ProKitTest extends TestCase {
    protected function setUp(): void {
        edc_test_reset_hooks();
        GlobalsStore::clear();
    }

    public function test_pro_wires_kit_globals_into_free_resolver(): void {
        \ElementorDivi5Converter\Pro\Plugin::instance()->register_hooks();
        GlobalsStore::save( [ 'kitcolor1' => '#123456' ], [], 'test-kit' );
        $this->assertSame( '#123456', GlobalsResolver::resolveColor( 'kitcolor1' ) );
    }

    public function test_pro_supplies_theme_builder_exporter(): void {
        \ElementorDivi5Converter\Pro\Plugin::instance()->register_hooks();
        $exporter = apply_filters( 'edc_theme_builder_exporter', null );
        $this->assertInstanceOf( \ElementorDivi5Converter\Pro\Exporters\DiviThemeBuilderExporter::class, $exporter );
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `vendor/bin/phpunit --filter ProKitTest` → FAIL (Pro Kit classes missing; filters not wired).

- [ ] **Step 3: Copy + renamespace the classes; wire `register_hooks`**

Copy the three classes as listed in **Files** (change only: namespace line, any `use ElementorDivi5Converter\Premium\...` internal references, and fully-qualify free-plugin classes). Then in Pro `class-plugin.php` `register_hooks()`, after the `edc_pro_active` filter:

```php
        add_filter( 'edc_kit_globals', static fn ( $v ) => $v ?? Kit\GlobalsStore::load() );
        add_filter( 'edc_theme_builder_exporter', static function ( $v ) {
            return $v ?? new Exporters\DiviThemeBuilderExporter( new \ElementorDivi5Converter\Exporters\DiviExporter() );
        } );

        if ( is_admin() ) {
            ( new Admin\KitPage() )->init();
        }
```

(Match `DiviThemeBuilderExporter`'s real constructor signature — read the copied class; the free `BatchImporter` passed it a `DiviExporter`.)

`class-kit-page.php`: a class with `init()` registering `admin_menu` (add_management_page 'Elementor → Divi 5 Pro', slug `edcp-kit`, cap `manage_options`) + `admin_init` → `handle_post()` dispatching the SAME action names/nonces as the ported code (`edc_upload_kit`, `edc_convert_kit_pages`, `edc_clear_kit`) so the ported handler bodies work with minimal edits. Port the render methods as tabs (`kit` default). Update internal references: `PremiumManager::is_active()` checks inside ported code are DELETED (Pro present = features on, soft enforcement); `KitGlobalsParser`/`GlobalsStore` references point to the Pro Kit namespace. The ZIP-import flow reuses free's `\ElementorDivi5Converter\Parsers\ElementorImportParser` and `\ElementorDivi5Converter\Admin\BatchImporter` fully-qualified.

Update `tests/HeaderTemplateConversionTest.php` imports to the Pro exporter class (`ElementorDivi5Converter\Pro\Exporters\DiviThemeBuilderExporter`); keep every assertion.

- [ ] **Step 4: Run tests**

Run: `vendor/bin/phpunit --filter "ProKitTest|HeaderTemplateConversionTest|SeamsTest"` → PASS.
Full suite → green.

- [ ] **Step 5: Commit**

```bash
git add plugin/jhmg-converter-for-elementor-to-divi-pro tests/ProKitTest.php tests/HeaderTemplateConversionTest.php
git commit -m "feat(pro): kit import, global styles, Theme Builder export moved in and wired to free seams"
```

---

### Task 5: Free-plugin surgery — remove premium code, real upsell (PLUGIN_REPO)

Now that Pro owns the features, physically remove them from free and point the upsell at divi5lab.

**Files:**
- Delete: `plugin/jhmg-converter-for-elementor-to-divi/includes/premium/` (all 3 files)
- Delete: `plugin/jhmg-converter-for-elementor-to-divi/includes/exporters/class-divi-theme-builder-exporter.php`
- Modify: `plugin/jhmg-converter-for-elementor-to-divi/includes/admin/class-admin-page.php` (major surgery, below)
- Modify: `plugin/jhmg-converter-for-elementor-to-divi/jhmg-converter-for-elementor-to-divi.php` (deactivation hook :29-31 — remove the `edc_premium_active` delete)
- Test: `tests/FreeAdminSurgeryTest.php` (new)

**Surgery list for `class-admin-page.php`:**
1. Delete the three premium `use` imports (:6-8).
2. Delete methods: `handle_activate_premium` (:872-883), `handle_upload_kit` (:885-1022), `handle_convert_kit_pages` (:1025-1129), `handle_clear_kit` (:1131-1146), `render_global_kit_section` (:1186-1217), `render_premium_upsell` (:1219-1234), `render_kit_status` (:1237-1420), `render_kit_upload_form` (:1421-1491). Delete their dispatch lines in `handle_post()` (:81-95, keep `edc_import` and `publish`) and the kit nonce constants (:19-23, keep import + publish nonces).
3. `handle_import()` ZIP gate (:123-128): replace the `PremiumManager::is_active()` check with an unconditional block:

```php
        if ( strtolower( pathinfo( $original_name, PATHINFO_EXTENSION ) ) === 'zip' ) {
            wp_die(
                esc_html__( 'Full kit ZIP import is a Pro feature. The free plugin imports single-page JSON exports (unlimited). Get Pro at divi5lab.com/plugins/elementor-to-divi-5', 'jhmg-converter-for-elementor-to-divi' ),
                '',
                [ 'back_link' => true ]
            );
        }
```
(Keep the existing variable names from the surrounding code.)
4. `render_list()` (:247): remove the `PremiumManager::is_active()` branch — ALWAYS render the free landing (`render_premium_landing()`, rename to `render_landing()` and update the one call site). Inside the landing, at the top, add a Pro-installed banner:

```php
        if ( apply_filters( 'edc_pro_active', false ) ) {
            echo '<div class="notice notice-success inline"><p>';
            echo wp_kses_post( __( '<strong>Pro is active.</strong> Kit import and Theme Builder tools live under <a href="' . esc_url( admin_url( 'tools.php?page=edcp-kit' ) ) . '">Tools → Elementor → Divi 5 Pro</a>.', 'jhmg-converter-for-elementor-to-divi' ) );
            echo '</p></div>';
        }
```
5. In the landing's Premium column and anywhere an "Activate Premium"/"Upgrade" form POSTs `edc_activate_premium` (buttons at :505-512), replace the `<form>` with a link:

```php
        printf(
            '<a class="button button-primary button-hero" href="%s" target="_blank" rel="noopener">%s</a>',
            esc_url( 'https://divi5lab.com/plugins/elementor-to-divi-5?utm_source=plugin&utm_medium=upsell&utm_campaign=free-landing' ),
            esc_html__( 'Get Pro — $49/yr, unlimited sites', 'jhmg-converter-for-elementor-to-divi' )
        );
```
6. `render_import_section()` free-notice branch (:572): keep the notice but link it to the same URL (it renders only for the Pro page now — actually this method stays for the free landing's embedded import form; verify who calls it after surgery and delete it if it became dead code).
7. Leave `uninstall.php` unchanged (defensive `edc_premium_active`/`edc_kit_globals` deletes are harmless and clean up old installs).

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/FreeAdminSurgeryTest.php
use PHPUnit\Framework\TestCase;

class FreeAdminSurgeryTest extends TestCase {
    private const FREE = __DIR__ . '/../plugin/jhmg-converter-for-elementor-to-divi';

    public function test_no_premium_namespace_left_in_free(): void {
        $hits = shell_exec( 'grep -rn "Premium\\\\\\\\PremiumManager\|premium/class-\|PremiumManager::" ' . escapeshellarg( self::FREE . '/includes' ) . ' || true' );
        $this->assertSame( '', trim( (string) $hits ), "Premium references remain:\n$hits" );
    }

    public function test_premium_dir_and_tb_exporter_gone(): void {
        $this->assertDirectoryDoesNotExist( self::FREE . '/includes/premium' );
        $this->assertFileDoesNotExist( self::FREE . '/includes/exporters/class-divi-theme-builder-exporter.php' );
    }

    public function test_upsell_links_to_divi5lab(): void {
        $admin = (string) file_get_contents( self::FREE . '/includes/admin/class-admin-page.php' );
        $this->assertStringContainsString( 'divi5lab.com/plugins/elementor-to-divi-5', $admin );
        $this->assertStringNotContainsString( 'edc_activate_premium', $admin );
    }
}
```

- [ ] **Step 2: Run to verify it fails** → `vendor/bin/phpunit --filter FreeAdminSurgeryTest` FAILs on all three.

- [ ] **Step 3: Perform the surgery** per the list above.

- [ ] **Step 4: Run tests** — `vendor/bin/phpunit` full suite green (Pro tests from Task 4 prove the moved features still work; free tests prove nothing broke). Also run a PHP lint sweep: `find plugin -name '*.php' -exec php -l {} \; | grep -v "No syntax errors" || echo "all clean"`.

- [ ] **Step 5: Commit**

```bash
git add -A plugin/jhmg-converter-for-elementor-to-divi tests/FreeAdminSurgeryTest.php
git commit -m "feat(free)!: remove premium code (wp.org guideline 5) — real divi5lab upsell links"
```

---

### Task 6: License client — canonical copy + Pro integration (both repos)

**Files:**
- Create (SITE_REPO): `lib/license-server/php-client/class-license-client.php` (canonical)
- Create (SITE_REPO): `scripts/sync-license-client.sh`
- Create (PLUGIN_REPO, via the sync script): `.../divi-pro/includes/licensing/class-license-client.php`
- Create (PLUGIN_REPO): `.../divi-pro/includes/licensing/class-license-page.php` (settings tab UI)
- Modify (PLUGIN_REPO): Pro `includes/class-plugin.php` (wire licensing + update filter)
- Modify (PLUGIN_REPO): `tests/bootstrap.php` (add `wp_remote_post`/`wp_remote_get`/`wp_remote_retrieve_*` stubs backed by `$GLOBALS['edc_test_http']`)
- Test (PLUGIN_REPO): `tests/LicenseClientTest.php`

**Interfaces:**
- Produces — `ElementorDivi5Converter\Pro\Licensing\LicenseClient`:
  - `__construct( string $product, string $plugin_version, string $api_base, string $plugin_basename )`
  - `activate( string $key ): array` — POST `/api/license/activate`; on HTTP 200 stores key (`edcp_license_key`) + state (`edcp_license_state` = `['status','expires','checked_at']`); returns `['ok'=>bool,'error'=>?string,'status'=>?string]`
  - `deactivate(): void` — POST `/api/license/deactivate`, clears both options
  - `get_key(): ?string`, `get_state(): ?array`
  - `refresh( bool $force = false ): void` — POST `/api/license/validate` when `checked_at` older than `DAY_IN_SECONDS` (or forced); network failure inside `3 * DAY_IN_SECONDS` keeps last state; HTTP 403/404 updates state to the returned status / `invalid`
  - `inject_update( $transient )` — for `pre_set_site_transient_update_plugins`: GET `/api/plugin/update-check?product=&version=&key=`; when `update:true` AND `package` present, sets `$transient->response[ $this->plugin_basename ]` to `(object)['slug','new_version','package','url']`; when `update:true` without `package`, stores a flag option `edcp_update_blocked` (renew notice) and injects nothing
  - `status_notice(): void` — admin notice: no key → "activate your license"; expired/canceled → "renew for updates"; `edcp_update_blocked` → "update available, renew to receive it". Soft enforcement: notices only, never disables features.

- [ ] **Step 1: Add HTTP stubs to `tests/bootstrap.php`**

```php
$GLOBALS['edc_test_http'] = [ 'queue' => [], 'log' => [] ];

if ( ! function_exists( 'edc_test_http_queue' ) ) {
    /** Queue a fake response: ['code'=>200,'body'=>['status'=>'active',...]] or new WP_Error(...) */
    function edc_test_http_queue( $response ) { $GLOBALS['edc_test_http']['queue'][] = $response; }
}
if ( ! function_exists( 'wp_remote_post' ) ) {
    function wp_remote_post( $url, $args = [] ) {
        $GLOBALS['edc_test_http']['log'][] = [ 'method' => 'POST', 'url' => $url, 'args' => $args ];
        $r = array_shift( $GLOBALS['edc_test_http']['queue'] );
        return $r instanceof WP_Error ? $r : [ 'response' => [ 'code' => $r['code'] ], 'body' => json_encode( $r['body'] ) ];
    }
}
if ( ! function_exists( 'wp_remote_get' ) ) {
    function wp_remote_get( $url, $args = [] ) {
        $GLOBALS['edc_test_http']['log'][] = [ 'method' => 'GET', 'url' => $url, 'args' => $args ];
        $r = array_shift( $GLOBALS['edc_test_http']['queue'] );
        return $r instanceof WP_Error ? $r : [ 'response' => [ 'code' => $r['code'] ], 'body' => json_encode( $r['body'] ) ];
    }
}
if ( ! function_exists( 'wp_remote_retrieve_response_code' ) ) {
    function wp_remote_retrieve_response_code( $r ) { return is_array( $r ) ? ( $r['response']['code'] ?? 0 ) : 0; }
}
if ( ! function_exists( 'wp_remote_retrieve_body' ) ) {
    function wp_remote_retrieve_body( $r ) { return is_array( $r ) ? ( $r['body'] ?? '' ) : ''; }
}
if ( ! function_exists( 'is_wp_error' ) ) { /* likely already stubbed — check; add only if missing */ }
if ( ! defined( 'DAY_IN_SECONDS' ) ) { define( 'DAY_IN_SECONDS', 86400 ); }
if ( ! function_exists( 'home_url' ) ) { function home_url() { return 'https://test-site.example'; } }
```

(Check for existing `is_wp_error`/`home_url`/transient stubs before adding — the bootstrap already has an options/transients store.)

- [ ] **Step 2: Write the failing test**

```php
<?php
// tests/LicenseClientTest.php
use PHPUnit\Framework\TestCase;
use ElementorDivi5Converter\Pro\Licensing\LicenseClient;

class LicenseClientTest extends TestCase {
    private LicenseClient $client;

    protected function setUp(): void {
        edc_test_reset_hooks();
        $GLOBALS['edc_test_http'] = [ 'queue' => [], 'log' => [] ];
        delete_option( 'edcp_license_key' );
        delete_option( 'edcp_license_state' );
        delete_option( 'edcp_update_blocked' );
        $this->client = new LicenseClient( 'elementor-to-divi5-pro', '1.0.0', 'https://divi5lab.com', 'jhmg-converter-for-elementor-to-divi-pro/jhmg-converter-for-elementor-to-divi-pro.php' );
    }

    public function test_activate_success_stores_key_and_state(): void {
        edc_test_http_queue( [ 'code' => 200, 'body' => [ 'status' => 'active', 'product' => 'elementor-to-divi5-pro', 'expires' => '2027-07-11T00:00:00.000Z' ] ] );
        $res = $this->client->activate( 'JHMG-AAAA-BBBB-CCCC-DDDD' );
        $this->assertTrue( $res['ok'] );
        $this->assertSame( 'JHMG-AAAA-BBBB-CCCC-DDDD', $this->client->get_key() );
        $this->assertSame( 'active', $this->client->get_state()['status'] );
        // Wire contract: snake_case params to the right endpoint.
        $call = $GLOBALS['edc_test_http']['log'][0];
        $this->assertSame( 'https://divi5lab.com/api/license/activate', $call['url'] );
        $body = json_decode( $call['args']['body'], true );
        $this->assertSame( [ 'key', 'site_url', 'product', 'plugin_version', 'wp_version' ], array_keys( $body ) );
    }

    public function test_activate_invalid_key_reports_error(): void {
        edc_test_http_queue( [ 'code' => 404, 'body' => [ 'error' => 'invalid_key' ] ] );
        $res = $this->client->activate( 'JHMG-ZZZZ-ZZZZ-ZZZZ-ZZZZ' );
        $this->assertFalse( $res['ok'] );
        $this->assertSame( 'invalid_key', $res['error'] );
        $this->assertNull( $this->client->get_key() );
    }

    public function test_refresh_skips_within_24h_cache(): void {
        update_option( 'edcp_license_key', 'JHMG-AAAA-BBBB-CCCC-DDDD' );
        update_option( 'edcp_license_state', [ 'status' => 'active', 'expires' => null, 'checked_at' => time() - 100 ] );
        $this->client->refresh();
        $this->assertCount( 0, $GLOBALS['edc_test_http']['log'] );
    }

    public function test_refresh_network_failure_within_grace_keeps_state(): void {
        update_option( 'edcp_license_key', 'JHMG-AAAA-BBBB-CCCC-DDDD' );
        update_option( 'edcp_license_state', [ 'status' => 'active', 'expires' => null, 'checked_at' => time() - 2 * DAY_IN_SECONDS ] );
        edc_test_http_queue( new WP_Error( 'http_failure', 'timeout' ) );
        $this->client->refresh();
        $this->assertSame( 'active', $this->client->get_state()['status'] );
    }

    public function test_inject_update_adds_package_when_licensed(): void {
        update_option( 'edcp_license_key', 'JHMG-AAAA-BBBB-CCCC-DDDD' );
        edc_test_http_queue( [ 'code' => 200, 'body' => [ 'update' => true, 'version' => '1.1.0', 'changelog' => 'x', 'package' => 'https://divi5lab.com/api/plugin/download?product=elementor-to-divi5-pro&key=JHMG-AAAA-BBBB-CCCC-DDDD' ] ] );
        $t = $this->client->inject_update( (object) [ 'response' => [] ] );
        $entry = $t->response['jhmg-converter-for-elementor-to-divi-pro/jhmg-converter-for-elementor-to-divi-pro.php'];
        $this->assertSame( '1.1.0', $entry->new_version );
        $this->assertStringContainsString( '/api/plugin/download', $entry->package );
    }

    public function test_inject_update_without_package_sets_renewal_flag(): void {
        update_option( 'edcp_license_key', 'JHMG-AAAA-BBBB-CCCC-DDDD' );
        edc_test_http_queue( [ 'code' => 200, 'body' => [ 'update' => true, 'version' => '1.1.0', 'changelog' => 'x' ] ] );
        $t = $this->client->inject_update( (object) [ 'response' => [] ] );
        $this->assertArrayNotHasKey( 'jhmg-converter-for-elementor-to-divi-pro/jhmg-converter-for-elementor-to-divi-pro.php', $t->response );
        $this->assertNotEmpty( get_option( 'edcp_update_blocked' ) );
    }
}
```

- [ ] **Step 3: Run to verify it fails** → `vendor/bin/phpunit --filter LicenseClientTest` FAIL (class missing).

- [ ] **Step 4: Write the canonical client (SITE_REPO) + sync**

`lib/license-server/php-client/class-license-client.php` — implement to the interface above. Skeleton (fill each method exactly per the tests; this file is the single source of truth, header comment states that):

```php
<?php
/**
 * JHMG License Client — CANONICAL COPY.
 * Source of truth: layoutlab repo, lib/license-server/php-client/class-license-client.php
 * Synced into Pro plugins via scripts/sync-license-client.sh — DO NOT edit the plugin copies.
 * API contract (frozen): /api/license/{activate,validate,deactivate}, /api/plugin/update-check
 * Error codes: invalid_key | product_mismatch | license_not_usable | rate_limited | invalid_request
 */

namespace ElementorDivi5Converter\Pro\Licensing;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class LicenseClient {
    private const OPT_KEY     = 'edcp_license_key';
    private const OPT_STATE   = 'edcp_license_state';
    private const OPT_BLOCKED = 'edcp_update_blocked';
    private const CACHE_TTL   = DAY_IN_SECONDS;
    private const GRACE_TTL   = 3 * DAY_IN_SECONDS;

    public function __construct(
        private string $product,
        private string $plugin_version,
        private string $api_base,
        private string $plugin_basename
    ) {}

    public function get_key(): ?string { $k = get_option( self::OPT_KEY, '' ); return $k !== '' ? $k : null; }
    public function get_state(): ?array { $s = get_option( self::OPT_STATE, null ); return is_array( $s ) ? $s : null; }

    public function activate( string $key ): array {
        $res = $this->post( '/api/license/activate', [
            'key'            => $key,
            'site_url'       => home_url(),
            'product'        => $this->product,
            'plugin_version' => $this->plugin_version,
            'wp_version'     => function_exists( 'get_bloginfo' ) ? get_bloginfo( 'version' ) : '',
        ] );
        if ( $res['ok'] ) {
            update_option( self::OPT_KEY, $key, false );
            $this->store_state( $res['body'] );
            return [ 'ok' => true, 'error' => null, 'status' => $res['body']['status'] ?? null ];
        }
        return [ 'ok' => false, 'error' => $res['error'], 'status' => $res['body']['status'] ?? null ];
    }

    public function deactivate(): void {
        $key = $this->get_key();
        if ( $key ) {
            $this->post( '/api/license/deactivate', [ 'key' => $key, 'site_url' => home_url() ] );
        }
        delete_option( self::OPT_KEY );
        delete_option( self::OPT_STATE );
        delete_option( self::OPT_BLOCKED );
    }

    public function refresh( bool $force = false ): void {
        $key = $this->get_key();
        if ( ! $key ) { return; }
        $state = $this->get_state();
        $age   = time() - (int) ( $state['checked_at'] ?? 0 );
        if ( ! $force && $age < self::CACHE_TTL ) { return; }

        $res = $this->post( '/api/license/validate', [ 'key' => $key, 'site_url' => home_url(), 'product' => $this->product ] );
        if ( $res['network_error'] ) {
            // Offline grace: keep last-known state up to GRACE_TTL past the cache window.
            if ( $age < self::CACHE_TTL + self::GRACE_TTL && $state ) { return; }
            return; // Beyond grace we STILL keep last state (soft enforcement) — notices handle messaging.
        }
        if ( $res['ok'] ) {
            $this->store_state( $res['body'] );
        } else {
            $this->store_state( [ 'status' => $res['body']['status'] ?? 'invalid', 'expires' => $state['expires'] ?? null ] );
        }
    }

    public function inject_update( $transient ) {
        $key = $this->get_key();
        $url = sprintf(
            '%s/api/plugin/update-check?product=%s&version=%s%s',
            $this->api_base,
            rawurlencode( $this->product ),
            rawurlencode( $this->plugin_version ),
            $key ? '&key=' . rawurlencode( $key ) : ''
        );
        $raw = wp_remote_get( $url, [ 'timeout' => 10 ] );
        if ( is_wp_error( $raw ) || wp_remote_retrieve_response_code( $raw ) !== 200 ) { return $transient; }
        $body = json_decode( wp_remote_retrieve_body( $raw ), true );
        if ( empty( $body['update'] ) ) { delete_option( self::OPT_BLOCKED ); return $transient; }
        if ( empty( $body['package'] ) ) {
            update_option( self::OPT_BLOCKED, $body['version'] ?? '1', false );
            return $transient;
        }
        delete_option( self::OPT_BLOCKED );
        if ( ! is_object( $transient ) ) { $transient = (object) [ 'response' => [] ]; }
        $transient->response[ $this->plugin_basename ] = (object) [
            'slug'        => dirname( $this->plugin_basename ),
            'new_version' => $body['version'],
            'package'     => $body['package'],
            'url'         => 'https://divi5lab.com/plugins/elementor-to-divi-5',
        ];
        return $transient;
    }

    private function store_state( array $body ): void {
        update_option( self::OPT_STATE, [
            'status'     => $body['status'] ?? 'unknown',
            'expires'    => $body['expires'] ?? null,
            'checked_at' => time(),
        ], false );
    }

    /** @return array{ok:bool, error:?string, body:array, network_error:bool} */
    private function post( string $path, array $payload ): array {
        $raw = wp_remote_post( $this->api_base . $path, [
            'timeout' => 10,
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body'    => wp_json_encode( $payload ),
        ] );
        if ( is_wp_error( $raw ) ) {
            return [ 'ok' => false, 'error' => 'network_error', 'body' => [], 'network_error' => true ];
        }
        $code = wp_remote_retrieve_response_code( $raw );
        $body = json_decode( wp_remote_retrieve_body( $raw ), true ) ?: [];
        if ( $code === 200 ) {
            return [ 'ok' => true, 'error' => null, 'body' => $body, 'network_error' => false ];
        }
        return [ 'ok' => false, 'error' => $body['error'] ?? "http_$code", 'body' => $body, 'network_error' => false ];
    }
}
```

(`wp_json_encode` may need a bootstrap stub aliasing `json_encode` — check.)

`scripts/sync-license-client.sh` (SITE_REPO):

```bash
#!/usr/bin/env bash
# Sync the canonical PHP license client into the Pro plugin(s).
set -euo pipefail
SRC="$(dirname "$0")/../lib/license-server/php-client/class-license-client.php"
DEST_E2D5="/Users/Lucas/Documents/JHMG-Local/jhmg-elementor-to-divi5/plugin/jhmg-converter-for-elementor-to-divi-pro/includes/licensing/class-license-client.php"
mkdir -p "$(dirname "$DEST_E2D5")"
cp "$SRC" "$DEST_E2D5"
echo "synced -> $DEST_E2D5"
```

Run it. Commit the canonical + script in SITE_REPO (`chore(licensing): canonical PHP license client + sync script`); the synced copy commits with the plugin repo work below.

- [ ] **Step 5: Pro wiring + settings UI (PLUGIN_REPO)**

`includes/licensing/class-license-page.php`: a `License` tab on the Pro admin page (or a second `add_management_page` section inside `KitPage` — implement as a tab in `KitPage` to keep one Pro page): key input form (POST action `edcp_save_license`, nonce `edcp_license`), current status line (from `get_state()`, with expiry date), Activate/Deactivate buttons calling the client, and a "Check again" (force refresh) button. In Pro `class-plugin.php` `register_hooks()`:

```php
        $license = new Licensing\LicenseClient(
            EDCP_PRODUCT_SLUG,
            EDCP_PLUGIN_VERSION,
            EDCP_API_BASE,
            plugin_basename( EDCP_PLUGIN_FILE )
        );
        add_filter( 'pre_set_site_transient_update_plugins', [ $license, 'inject_update' ] );
        if ( is_admin() ) {
            add_action( 'admin_init', function () use ( $license ) { $license->refresh(); } );
            add_action( 'admin_notices', [ new Licensing\LicensePage( $license ), 'maybe_render_notice' ] );
        }
```

(`plugin_basename` needs a bootstrap stub if the suite loads it — check.)

- [ ] **Step 6: Run tests** — `vendor/bin/phpunit --filter LicenseClientTest` PASS (6 tests); full suite green.

- [ ] **Step 7: Commit (PLUGIN_REPO)**

```bash
git add plugin/jhmg-converter-for-elementor-to-divi-pro tests/bootstrap.php tests/LicenseClientTest.php
git commit -m "feat(pro): license client (synced canonical) — activate/validate, soft enforcement, WP-native updates"
```

---

### Task 7: Minimal buy page on divi5lab (SITE_REPO)

**Files:**
- Create: `app/(marketing)/plugins/elementor-to-divi-5/page.tsx`
- Create: `components/plugins/BuyProButton.tsx`
- Test: `tests/plugin-product-page.test.tsx`, `tests/buy-pro-button.test.tsx`

**Interfaces:**
- Consumes: existing `POST /api/checkout` with `{ kind: 'plugin', product: 'elementor-to-divi5-pro' }`; UI primitives `Container`/`Card`; `lib/seo` metadata patterns (mirror an existing marketing page such as `app/(marketing)/about/page.tsx` for metadata conventions).
- Produces: public page at `/plugins/elementor-to-divi-5` (the URL the plugin upsells link to — must match exactly).

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/buy-pro-button.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BuyProButton } from '@/components/plugins/BuyProButton';

describe('BuyProButton', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('POSTs the plugin product to /api/checkout and redirects to the session url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/cs_test_x' }) });
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    render(<BuyProButton product="elementor-to-divi5-pro" label="Get Pro" />);
    fireEvent.click(screen.getByRole('button', { name: /get pro/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_x'));
    expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ kind: 'plugin', product: 'elementor-to-divi5-pro' }),
    }));
  });

  it('shows an error state when checkout fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: 'plugin_unavailable' }) }));
    render(<BuyProButton product="elementor-to-divi5-pro" label="Get Pro" />);
    fireEvent.click(screen.getByRole('button', { name: /get pro/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeTruthy());
  });
});
```

```tsx
// tests/plugin-product-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PluginPage, { metadata } from '@/app/(marketing)/plugins/elementor-to-divi-5/page';

describe('/plugins/elementor-to-divi-5', () => {
  it('renders hero, free-vs-pro comparison and price', async () => {
    render(await PluginPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Elementor to Divi 5/i);
    expect(screen.getByText(/\$49/)).toBeTruthy();
    expect(screen.getAllByText(/kit zip import/i).length).toBeGreaterThan(0);
  });

  it('embeds Product JSON-LD with the offer', async () => {
    const { container } = render(await PluginPage());
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(ld).toBeTruthy();
    const data = JSON.parse(ld!.textContent ?? '{}');
    expect(data['@type']).toBe('Product');
    expect(data.offers.price).toBe('49.00');
  });

  it('has SEO metadata', () => {
    expect(metadata.title).toMatch(/Elementor to Divi 5/i);
    expect(String(metadata.description)).toMatch(/convert/i);
  });
});
```

- [ ] **Step 2: Run to verify they fail** → `npx vitest run tests/buy-pro-button.test.tsx tests/plugin-product-page.test.tsx` FAIL (modules missing).

- [ ] **Step 3: Implement**

```tsx
// components/plugins/BuyProButton.tsx
'use client';
import { useState } from 'react';

export function BuyProButton({ product, label }: { product: string; label: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const buy = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'plugin', product }),
      });
      const json = await res.json();
      if (json.url) { window.location.assign(json.url); return; }
      setState('error');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <button
        onClick={buy}
        disabled={state === 'loading'}
        className="inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110 disabled:opacity-60"
      >
        {state === 'loading' ? 'Redirecting…' : label}
      </button>
      {state === 'error' && (
        <p className="mt-2 text-small text-red-600">Something went wrong — please try again or email support@divi5lab.com.</p>
      )}
    </div>
  );
}
```

`app/(marketing)/plugins/elementor-to-divi-5/page.tsx` — RSC. Mirror the styling conventions of the existing marketing pages (read `app/(marketing)/about/page.tsx` first for `Container`/type classes/metadata shape). Content requirements (exact copy adjustable, structure not):
- `export const metadata`: title `Elementor to Divi 5 Converter — Free plugin + Pro | Divi5Lab`, description mentioning converting Elementor pages/kits to Divi 5.
- H1 "Convert Elementor to Divi 5", subhead, two CTAs: wp.org link (`https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/` — "Get the free plugin") and `<BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />`.
- Free vs Pro comparison table: Free = unlimited single-page JSON imports, 140+ widget mappings, conversion reports; Pro = full kit ZIP import, global headers/footers → Divi Theme Builder, global colors & typography, priority support, 1 year of updates, unlimited sites.
- "How it works" 3 steps (export JSON/kit in Elementor → upload in Tools → review & publish).
- Short FAQ (Is it really unlimited sites? What happens if I don't renew? — keeps working, no updates; Do I need the free plugin? — yes, Pro extends it).
- Product JSON-LD `<script type="application/ld+json">` with `@type: Product`, name, description, `offers: { '@type': 'Offer', price: '49.00', priceCurrency: 'USD', url: 'https://divi5lab.com/plugins/elementor-to-divi-5' }`.

- [ ] **Step 4: Run tests + typecheck** — `npx vitest run tests/buy-pro-button.test.tsx tests/plugin-product-page.test.tsx` PASS; `npm run typecheck` clean; `npm run test` full suite green.

- [ ] **Step 5: Commit (SITE_REPO)**

```bash
git add "app/(marketing)/plugins" components/plugins tests/buy-pro-button.test.tsx tests/plugin-product-page.test.tsx
git commit -m "feat(store): Elementor→Divi 5 product page + plugin checkout button"
```

---

### Task 8: Live local e2e — the whole funnel against a real WordPress (both repos, operator-assisted)

No new production code; this is the verification-before-completion gate. Evidence (command output/screenshots) goes in the task report.

- [ ] **Step 1: Mint a dev license.** Create `scripts/mint-dev-license.ts` in SITE_REPO (operator utility, also useful later for comping licenses):

```ts
// scripts/mint-dev-license.ts
// Mint a license row directly (dev/support use). Usage:
//   npx tsx scripts/mint-dev-license.ts --email you@x.com --product elementor-to-divi5-pro [--years 1]
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { licenses } from '@/db/schema';
import { generateLicenseKey, PLUGIN_PRODUCTS } from '@/lib/license-server/core';
import { findOrCreateUserByEmail } from '@/lib/users/find-or-create';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email'); const product = arg('product'); const years = Number(arg('years') ?? '1');
  if (!email || !product || !(PLUGIN_PRODUCTS as readonly string[]).includes(product)) {
    console.error('Usage: --email <email> --product <slug> [--years N]'); process.exit(1);
  }
  const userId = await findOrCreateUserByEmail(email);
  const licenseKey = generateLicenseKey();
  const end = new Date(); end.setFullYear(end.getFullYear() + years);
  await db.insert(licenses).values({
    id: randomUUID(), userId, productSlug: product, licenseKey, status: 'active',
    stripeSubscriptionId: null, currentPeriodEnd: end,
  });
  console.log(licenseKey);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

Add a small vitest for the arg validation ONLY if the repo pattern demands it; otherwise verify by running it (next step). Commit: `chore(licensing): dev/support license minting script`.

- [ ] **Step 2: Start the stack.** SITE_REPO dev server on port 3100 (`PORT=3100 npm run dev`); local WP: use the plugin repo's docker-compose (`cd "$PLUGIN_REPO" && docker compose up -d` — check its README/compose for the mapped port; the repo's existing dev container mounts the plugin). Ensure the Pro plugin folder is also visible to that WP (add a volume mount for `plugin/jhmg-converter-for-elementor-to-divi-pro` in docker-compose.yml mirroring the free plugin's mount — commit that compose change).
- [ ] **Step 3: Point Pro at the local license server.** In the WP container's `wp-config.php` (or via compose env → `WORDPRESS_CONFIG_EXTRA`): `define( 'EDCP_API_BASE', 'http://host.docker.internal:3100' );`
- [ ] **Step 4: Walk the funnel and capture evidence:**
  1. `npx tsx scripts/mint-dev-license.ts --email e2e@divi5lab-test.com --product elementor-to-divi5-pro` → key printed.
  2. wp-admin → activate free 2.1.0 + Pro 1.0.0 → no fatals; free landing shows the "Pro is active" banner and the divi5lab upsell link; Tools shows both pages.
  3. Pro → License tab → paste key → Activate → status "active" with expiry; confirm the activation row lands in the local DB (`license_activations.site_url`).
  4. Import a single-page JSON on the free page (works); import a kit ZIP on the Pro page (works, kit swatches render); convert a header template → lands in Divi Theme Builder.
  5. Deactivate the Pro plugin → free import still works; header template import degrades to a draft page with the Pro warning in the report.
  6. Publish a dummy Pro `1.0.1` to the LOCAL DB (`npx tsx scripts/release-plugin.ts --product elementor-to-divi5-pro --version 1.0.1 --dir <pro folder> --changelog test`), reactivate Pro, wp-admin → Dashboard → Updates → the Pro plugin shows 1.0.1 with divi5lab as the source; run the update → it installs.
- [ ] **Step 5: Record all evidence in the report; fix anything that breaks (TDD for any code fix); commit fixes.**

---

### Task 9: Releases — free 2.1.0 to wp.org, Pro 1.0.0 to prod (operator steps, confirm with Lucas before each push)

- [ ] **Step 1: Free 2.1.0 version + readme (PLUGIN_REPO).**
  - `jhmg-converter-for-elementor-to-divi.php`: header `Version: 2.1.0` (:6), `EDC_PLUGIN_VERSION` `'2.1.0'` (:25).
  - `readme.txt`: `Stable tag: 2.1.0`; rewrite premium claims (lines :11, :19-36, :42-45, :48-60, :72-80, :125-129, :147-153) from "Premium (in-plugin)" to "Pro add-on, available at divi5lab.com/plugins/elementor-to-divi-5"; add changelog block:

```
= 2.1.0 =
* Premium features (kit ZIP import, Theme Builder headers/footers, global styles) now live in the separate Pro add-on, available at https://divi5lab.com/plugins/elementor-to-divi-5
* New: extension hooks for companion plugins (edc_loaded, edc_kit_globals, edc_theme_builder_exporter, edc_pro_active)
* The in-plugin "premium preview" toggle has been removed
```
  - Commit: `release(free): 2.1.0 — premium moved to Pro add-on`.
- [ ] **Step 2: wp.org SVN (NEEDS LUCAS — svn credentials).** From `references/jhmg-converter-for-elementor-to-divi-4/`: `svn up`; rsync the free plugin into `trunk/` (delete removed files: `includes/premium/`, theme-builder exporter); `svn st` review; `svn add`/`svn rm` as flagged; `svn cp trunk tags/2.1.0`; `svn ci -m "2.1.0: premium features moved to Pro add-on; extension hooks"`. **Stop and confirm with Lucas before `svn ci`.**
- [ ] **Step 3: Pro 1.0.0 to prod (SITE_REPO, prod env — confirm with Lucas).**
  - `set -a; source .env.prod; set +a; npx tsx scripts/release-plugin.ts --product elementor-to-divi5-pro --version 1.0.0 --dir "$PLUGIN_REPO/plugin/jhmg-converter-for-elementor-to-divi-pro" --changelog "Initial Pro release"`
  - Verify: `curl "https://divi5lab.com/api/plugin/update-check?product=elementor-to-divi5-pro&version=0.9.0"` → `{"update":true,"version":"1.0.0","changelog":...}` with NO `package` (no key) — correct.
- [ ] **Step 4: Deploy the buy page** — push SITE_REPO main (confirm with Lucas), verify `https://divi5lab.com/plugins/elementor-to-divi-5` renders and its buy button returns a `cs_live_` URL.
- [ ] **Step 5: Close the loop.** Options for final live proof (Lucas's call): a real $49 self-purchase (then refund via dashboard) to receive the key email and download the Pro zip from `/account/licenses`; or trust the test-mode e2e + prod endpoint checks. Record the choice + evidence.

---

## Out of scope (later phases)

- Site rework beyond the single product page (home, /plugins hub, pricing, docs, nav, marketplace demotion) — Phase 3.
- Divi→Elementor free/Pro split + wp.org submission (reuses the seams pattern + synced license client) — Phase 4.
- AI Editor waitlist page — Phase 5.
- Uninstall survey, bundles, plugins_api "view details" popup for Pro.
