# AI Editor Connect Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single MCP snippet on the plugin's Settings → Connection panel with a guided, tabbed per-assistant setup (Claude · Cursor · VS Code · ChatGPT · Other) that says where each config goes, states MCP needs no Claude account, and gives ChatGPT its own OpenAPI-Actions path — plus fix the stale `$79/yr` → `$30/yr` price.

**Architecture:** A pure static builder (`AdminPage::connectClients`) produces the per-client machine data (snippets, transport, guide URLs) so it is unit-testable with synthetic inputs, exactly like the existing `McpConfigSnippetTest` pattern. A new `AdminPage::connectCard()` render method consumes it and emits the tabbed markup. The tab-switching JS **already exists** in `assets/admin.js` (`.aied-llm-tab` / `.aied-llm-panel` / `aied-panel-<id>`) but is currently unused and lacks an init pass; we render matching markup, add an init pass (progressive enhancement), and add the missing CSS.

**Tech Stack:** PHP 8.1+ (WordPress plugin), vanilla JS, hand-written CSS, PHPUnit (`vendor/bin/phpunit`, bootstrap `tests/bootstrap.php` with WP shims — no Docker/WP install needed for unit tests).

## Global Constraints

- **Two repos.** Plugin code: `/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator` (referred to below as `<plugin>`). Guides/price: `/Users/Lucas/Documents/JHMG-Local/layoutlab` (`<web>`).
- **i18n:** every user-facing string wrapped in `__()`, `esc_html__()`, or `esc_html_e()` with text domain `'ai-editor-divi5'`.
- **Escape all output:** `esc_html`, `esc_attr`, `esc_url` on everything echoed. Never echo raw client data.
- **No new dependencies.** Vanilla JS/CSS/PHP only.
- **Price is `$30/yr`** (source of truth: `<web>` pricing page, plugin page, nav, ProductDoors all show `$30`).
- **JS selectors are fixed** by the existing `admin.js`: tab buttons `.aied-llm-tab` with `data-target="<id>"`; panels `.aied-llm-panel` with `id="aied-panel-<id>"`; active class `aied-llm-tab--active`.
- **No-JS fallback:** panels must NOT be server-rendered with a `hidden` attribute. JS hides inactive panels on load; with JS off, all panels stay visible and usable.
- **Test runner:** `cd "<plugin>" && vendor/bin/phpunit` (whole suite) or `vendor/bin/phpunit --filter <name>`.

---

### Task 1: Pure per-assistant connection builder

**Files:**
- Modify: `<plugin>/wp-plugin/src/AdminPage.php` (add `connectClients()` static method; leave `connection()` for now — removed in Task 2)
- Test: `<plugin>/tests/ConnectClientsTest.php` (create)

**Interfaces:**
- Produces: `AdminPage::connectClients(string $siteUrl, string $apiKey): array` — returns an array keyed by client id (`claude`, `cursor`, `vscode`, `chatgpt`, `other`). Each value: `['transport' => 'mcp'|'actions', 'snippet' => ?string, 'guide' => ?string, 'specUrl' => ?string]`. MCP clients carry a JSON `snippet`; `chatgpt` carries `snippet => null`, `transport => 'actions'`, and a non-null `specUrl`.

- [ ] **Step 1: Write the failing test**

Create `<plugin>/tests/ConnectClientsTest.php`:

```php
<?php

declare(strict_types=1);

namespace Divi5Validator\Tests;

use AiEditorDivi5\WP\AdminPage;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../wp-plugin/src/AdminPage.php';

/**
 * The Connect panel offers per-assistant setup. This locks the machine-readable
 * shape of each client's config (transport, snippet format, spec/guide URLs) so
 * a bad edit to one client's snippet can't silently ship. Copy/markup is covered
 * by ConnectCardRenderTest; this file is data only.
 */
class ConnectClientsTest extends TestCase
{
    private const SITE = 'https://acme.example';
    private const KEY  = 'sk-test-abc123';

    /** @return array<string,mixed> */
    private function clients(): array
    {
        return AdminPage::connectClients(self::SITE, self::KEY);
    }

    public function testHasAllFiveClients(): void
    {
        $this->assertSame(
            ['claude', 'cursor', 'vscode', 'chatgpt', 'other'],
            array_keys($this->clients())
        );
    }

    public function testMcpClientsUseMcpServersShapeWithBearerKey(): void
    {
        foreach (['claude', 'cursor', 'other'] as $id) {
            $c = $this->clients()[$id];
            $this->assertSame('mcp', $c['transport'], "$id transport");
            $data = json_decode((string) $c['snippet'], true);
            $this->assertIsArray($data, "$id snippet is valid JSON");
            $entry = $data['mcpServers']['ai-editor-divi5'] ?? null;
            $this->assertIsArray($entry, "$id has mcpServers.ai-editor-divi5");
            $this->assertSame(self::SITE . '/wp-json/ai-editor-divi5/v1/mcp', $entry['url']);
            $this->assertSame('Bearer ' . self::KEY, $entry['headers']['Authorization']);
        }
    }

    public function testVsCodeUsesServersTypeHttpShape(): void
    {
        $c = $this->clients()['vscode'];
        $this->assertSame('mcp', $c['transport']);
        $data = json_decode((string) $c['snippet'], true);
        $this->assertIsArray($data, 'vscode snippet is valid JSON');
        $entry = $data['servers']['ai-editor-divi5'] ?? null;
        $this->assertIsArray($entry, 'vscode uses top-level "servers"');
        $this->assertArrayNotHasKey('mcpServers', $data, 'vscode must NOT use mcpServers');
        $this->assertSame('http', $entry['type']);
        $this->assertSame(self::SITE . '/wp-json/ai-editor-divi5/v1/mcp', $entry['url']);
        $this->assertSame('Bearer ' . self::KEY, $entry['headers']['Authorization']);
    }

    public function testChatgptUsesActionsWithSpecUrlAndNoSnippet(): void
    {
        $c = $this->clients()['chatgpt'];
        $this->assertSame('actions', $c['transport']);
        $this->assertNull($c['snippet'], 'ChatGPT has no MCP snippet');
        $this->assertSame(self::SITE . '/wp-json/ai-editor-divi5/v1/openapi.json', $c['specUrl']);
    }

    public function testEachClientLinksToItsGuide(): void
    {
        $c = $this->clients();
        $this->assertStringEndsWith('/guides/connect-claude-to-divi-5', (string) $c['claude']['guide']);
        $this->assertStringEndsWith('/guides/connect-cursor-to-divi-5', (string) $c['cursor']['guide']);
        $this->assertStringEndsWith('/guides/connect-cursor-to-divi-5', (string) $c['vscode']['guide']);
        $this->assertStringEndsWith('/guides/connect-chatgpt-to-divi-5', (string) $c['chatgpt']['guide']);
        $this->assertNull($c['other']['guide'], 'Other MCP client has no dedicated guide');
    }

    public function testTrailingSlashOnSiteUrlIsNormalized(): void
    {
        $c = AdminPage::connectClients(self::SITE . '/', self::KEY);
        $data = json_decode((string) $c['claude']['snippet'], true);
        $this->assertSame(
            self::SITE . '/wp-json/ai-editor-divi5/v1/mcp',
            $data['mcpServers']['ai-editor-divi5']['url']
        );
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "<plugin>" && vendor/bin/phpunit --filter ConnectClientsTest`
Expected: FAIL — `Error: Call to undefined method AiEditorDivi5\WP\AdminPage::connectClients()`.

- [ ] **Step 3: Implement `connectClients()`**

In `<plugin>/wp-plugin/src/AdminPage.php`, add this method to the class (place it just above the existing `private function connection()` at line 136):

```php
    /**
     * Pure per-assistant connection data. No WordPress calls beyond wp_json_encode
     * (shimmed in tests), so it is unit-testable directly with synthetic inputs.
     *
     * Snippet formats intentionally differ per client:
     *  - Claude / Cursor / Other MCP clients: {"mcpServers":{...}} with a bare url.
     *  - VS Code (mcp.json): {"servers":{...}} with "type":"http".
     *  - ChatGPT: no MCP snippet — it connects via OpenAPI Actions (specUrl).
     *
     * @return array<string, array{transport:string, snippet:?string, guide:?string, specUrl:?string}>
     */
    public static function connectClients(string $siteUrl, string $apiKey): array
    {
        $siteUrl = rtrim($siteUrl, '/');
        $mcpUrl  = $siteUrl . '/wp-json/ai-editor-divi5/v1/mcp';
        $specUrl = $siteUrl . '/wp-json/ai-editor-divi5/v1/openapi.json';
        $bearer  = "Bearer {$apiKey}";
        $flags   = JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES;

        $mcpSnippet = (string) wp_json_encode([
            'mcpServers' => ['ai-editor-divi5' => [
                'url'     => $mcpUrl,
                'headers' => ['Authorization' => $bearer],
            ]],
        ], $flags);

        $vscodeSnippet = (string) wp_json_encode([
            'servers' => ['ai-editor-divi5' => [
                'type'    => 'http',
                'url'     => $mcpUrl,
                'headers' => ['Authorization' => $bearer],
            ]],
        ], $flags);

        $guides = 'https://divi5lab.com/guides/';

        return [
            'claude'  => ['transport' => 'mcp',     'snippet' => $mcpSnippet,    'guide' => $guides . 'connect-claude-to-divi-5', 'specUrl' => null],
            'cursor'  => ['transport' => 'mcp',     'snippet' => $mcpSnippet,    'guide' => $guides . 'connect-cursor-to-divi-5', 'specUrl' => null],
            'vscode'  => ['transport' => 'mcp',     'snippet' => $vscodeSnippet, 'guide' => $guides . 'connect-cursor-to-divi-5', 'specUrl' => null],
            'chatgpt' => ['transport' => 'actions', 'snippet' => null,           'guide' => $guides . 'connect-chatgpt-to-divi-5', 'specUrl' => $specUrl],
            'other'   => ['transport' => 'mcp',     'snippet' => $mcpSnippet,    'guide' => null, 'specUrl' => null],
        ];
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "<plugin>" && vendor/bin/phpunit --filter ConnectClientsTest`
Expected: PASS (6 tests, all green).

- [ ] **Step 5: Commit**

```bash
cd "<plugin>"
git add wp-plugin/src/AdminPage.php tests/ConnectClientsTest.php
git commit -m "feat(admin): pure per-assistant connect builder (connectClients)"
```

---

### Task 2: Tabbed Connection card (render method, view, JS init, CSS)

**Files:**
- Modify: `<plugin>/tests/bootstrap.php` (add escaping shims so view code is unit-testable)
- Modify: `<plugin>/wp-plugin/src/AdminPage.php` (add `connectCard()`; rewrite `viewSettings()` Connection card at lines 398–424; remove now-unused `connection()`)
- Modify: `<plugin>/wp-plugin/assets/admin.js` (add init pass)
- Modify: `<plugin>/wp-plugin/assets/admin.css` (add tab/panel/step styles)
- Test: `<plugin>/tests/ConnectCardRenderTest.php` (create)

**Interfaces:**
- Consumes: `AdminPage::connectClients()` from Task 1.
- Produces: `AdminPage::connectCard(array $clients): void` — echoes the tabbed connection markup: a reassurance line, a `.aied-llm-tabs` row of `.aied-llm-tab` buttons, and five `.aied-llm-panel` panels (`id="aied-panel-<id>"`) each with steps, snippet/copy (MCP) or Actions steps (ChatGPT), a merge warning (MCP), and a guide link.

- [ ] **Step 1: Add escaping shims to the test bootstrap**

In `<plugin>/tests/bootstrap.php`, append (after the existing shims, before end of file):

```php
// ── View-layer escaping/i18n shims (identity-ish; enough to render admin views) ──
if ( ! function_exists( 'esc_html' ) ) {
    function esc_html( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
}
if ( ! function_exists( 'esc_attr' ) ) {
    function esc_attr( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
}
if ( ! function_exists( 'esc_url' ) ) {
    function esc_url( $s ) { return (string) $s; }
}
if ( ! function_exists( '__' ) ) {
    function __( $s, $d = null ) { return (string) $s; }
}
if ( ! function_exists( 'esc_html__' ) ) {
    function esc_html__( $s, $d = null ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
}
if ( ! function_exists( 'esc_attr__' ) ) {
    function esc_attr__( $s, $d = null ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
}
if ( ! function_exists( 'esc_html_e' ) ) {
    function esc_html_e( $s, $d = null ) { echo htmlspecialchars( (string) $s, ENT_QUOTES ); }
}
```

- [ ] **Step 2: Write the failing render test**

Create `<plugin>/tests/ConnectCardRenderTest.php`:

```php
<?php

declare(strict_types=1);

namespace Divi5Validator\Tests;

use AiEditorDivi5\WP\AdminPage;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../wp-plugin/src/AdminPage.php';

/**
 * Renders just the connect card and asserts the guidance a confused user needs:
 * per-client panels, "no Claude account" reassurance, merge warning, the
 * ChatGPT public-HTTPS caveat, guide links, and a no-JS-safe panel structure.
 */
class ConnectCardRenderTest extends TestCase
{
    private function render(): string
    {
        $clients = AdminPage::connectClients('https://acme.example', 'sk-test-abc123');
        ob_start();
        ( new AdminPage() )->connectCard($clients);
        return (string) ob_get_clean();
    }

    public function testRendersAllFivePanels(): void
    {
        $html = $this->render();
        foreach (['claude', 'cursor', 'vscode', 'chatgpt', 'other'] as $id) {
            $this->assertStringContainsString('id="aied-panel-' . $id . '"', $html);
            $this->assertStringContainsString('data-target="' . $id . '"', $html);
        }
    }

    public function testReassuresNoClaudeAccountNeeded(): void
    {
        $this->assertStringContainsString('account', strtolower($this->render()));
        $this->assertStringContainsString('open standard', strtolower($this->render()));
    }

    public function testMcpPanelsShowMergeWarning(): void
    {
        // The documented real bug: pasting the whole snippet into an existing config.
        $this->assertStringContainsString('only the inner', strtolower($this->render()));
    }

    public function testChatgptPanelExplainsActionsAndHttps(): void
    {
        $html = strtolower($this->render());
        $this->assertStringContainsString('actions', $html);
        $this->assertStringContainsString('https', $html);
    }

    public function testLinksToEachGuide(): void
    {
        $html = $this->render();
        $this->assertStringContainsString('/guides/connect-claude-to-divi-5', $html);
        $this->assertStringContainsString('/guides/connect-cursor-to-divi-5', $html);
        $this->assertStringContainsString('/guides/connect-chatgpt-to-divi-5', $html);
    }

    public function testPanelsAreNotServerHiddenForNoJsFallback(): void
    {
        // JS hides inactive panels on load; server output must not pre-hide them.
        $this->assertStringNotContainsString('aied-llm-panel" hidden', $this->render());
        $this->assertSame(5, substr_count($this->render(), 'aied-llm-panel'));
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd "<plugin>" && vendor/bin/phpunit --filter ConnectCardRenderTest`
Expected: FAIL — `Call to undefined method AiEditorDivi5\WP\AdminPage::connectCard()`.

- [ ] **Step 4: Implement `connectCard()`**

In `<plugin>/wp-plugin/src/AdminPage.php`, add this method directly below `connectClients()`:

```php
    /**
     * Renders the tabbed per-assistant connection UI. Panels are NOT server-hidden;
     * admin.js hides inactive ones on load (progressive enhancement / no-JS fallback).
     *
     * @param array<string, array{transport:string, snippet:?string, guide:?string, specUrl:?string}> $clients
     */
    public function connectCard( array $clients ): void
    {
        $tabs = [
            'claude'  => __( 'Claude', 'ai-editor-divi5' ),
            'cursor'  => __( 'Cursor', 'ai-editor-divi5' ),
            'vscode'  => __( 'VS Code', 'ai-editor-divi5' ),
            'chatgpt' => __( 'ChatGPT', 'ai-editor-divi5' ),
            'other'   => __( 'Other MCP client', 'ai-editor-divi5' ),
        ];
        ?>
        <p class="aied-connect-reassure">
            <strong><?php esc_html_e( 'MCP is an open standard', 'ai-editor-divi5' ); ?></strong> —
            <?php esc_html_e( 'it works with any of these assistants. You don’t need a Claude account or subscription to use it.', 'ai-editor-divi5' ); ?>
        </p>

        <div class="aied-llm-tabs" role="tablist">
            <?php $first = true; foreach ( $tabs as $id => $label ) : ?>
                <button type="button"
                        class="aied-llm-tab<?php echo $first ? ' aied-llm-tab--active' : ''; ?>"
                        data-target="<?php echo esc_attr( $id ); ?>">
                    <?php echo esc_html( $label ); ?>
                </button>
            <?php $first = false; endforeach; ?>
        </div>

        <?php foreach ( $tabs as $id => $label ) :
            $client = $clients[ $id ] ?? [];
            $guide  = $client['guide'] ?? null; ?>
            <div class="aied-llm-panel" id="aied-panel-<?php echo esc_attr( $id ); ?>" role="tabpanel">
                <?php $this->connectPanelBody( $id, $client ); ?>
                <?php if ( $guide ) : ?>
                    <a class="aied-guide-link" href="<?php echo esc_url( $guide ); ?>" target="_blank" rel="noopener noreferrer">
                        <?php esc_html_e( 'Full step-by-step guide →', 'ai-editor-divi5' ); ?>
                    </a>
                <?php endif; ?>
            </div>
        <?php endforeach;
    }

    /** Renders the per-client steps + snippet (MCP) or Actions steps (ChatGPT). */
    private function connectPanelBody( string $id, array $client ): void
    {
        // ChatGPT: OpenAPI Actions, not MCP.
        if ( ( $client['transport'] ?? '' ) === 'actions' ) {
            ?>
            <p class="aied-note"><strong><?php esc_html_e( 'ChatGPT uses Actions, not MCP.', 'ai-editor-divi5' ); ?></strong></p>
            <ol class="aied-steps">
                <li><?php esc_html_e( 'In ChatGPT, go to Explore GPTs → Create (or My GPTs → Create a GPT).', 'ai-editor-divi5' ); ?></li>
                <li><?php esc_html_e( 'Under Actions, click “Create new action”, then “Import from URL”.', 'ai-editor-divi5' ); ?></li>
                <li><?php
                    printf(
                        /* translators: %s: OpenAPI spec URL */
                        esc_html__( 'Paste your OpenAPI spec URL: %s', 'ai-editor-divi5' ),
                        '<a href="' . esc_url( (string) ( $client['specUrl'] ?? '' ) ) . '" target="_blank" rel="noopener noreferrer">openapi.json</a>'
                    ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- URL escaped inline.
                ?></li>
                <li><?php esc_html_e( 'Set Authentication to API Key, type Bearer, and paste the API key shown above.', 'ai-editor-divi5' ); ?></li>
            </ol>
            <p class="aied-merge-warn"><?php esc_html_e( 'Requires your site to be reachable over public HTTPS — localhost or an unreachable staging box will not work, because ChatGPT calls your site from OpenAI’s servers.', 'ai-editor-divi5' ); ?></p>
            <?php
            return;
        }

        // MCP clients: per-client destination steps, then the snippet + merge warning.
        $steps = $this->mcpSteps( $id );
        ?>
        <ol class="aied-steps"><?php foreach ( $steps as $step ) {
            // Each step may contain a single inline <code> span, pre-escaped in mcpSteps().
            echo '<li>' . $step . '</li>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from esc_html in mcpSteps.
        } ?></ol>
        <?php if ( ! empty( $client['snippet'] ) ) : ?>
            <div class="aied-snippet-wrap">
                <pre class="aied-snippet" id="snippet-<?php echo esc_attr( $id ); ?>"><?php echo esc_html( (string) $client['snippet'] ); ?></pre>
                <button class="button button-primary aied-copy-btn" data-target="snippet-<?php echo esc_attr( $id ); ?>"><?php esc_html_e( 'Copy', 'ai-editor-divi5' ); ?></button>
            </div>
            <p class="aied-merge-warn"><?php esc_html_e( 'Already have MCP servers configured? Paste only the inner "ai-editor-divi5": { … } entry into your existing list — not the whole snippet — or it will not load.', 'ai-editor-divi5' ); ?></p>
        <?php endif;
    }

    /**
     * Per-client "where does it go" steps. Returns HTML-safe list items; any inline
     * code is escaped here so the caller can echo them directly.
     *
     * @return list<string>
     */
    private function mcpSteps( string $id ): array
    {
        $code = static fn( string $s ): string => '<code>' . esc_html( $s ) . '</code>';
        switch ( $id ) {
            case 'claude':
                return [
                    esc_html__( 'Claude Desktop: open your config file —', 'ai-editor-divi5' ) . ' '
                        . $code( '~/Library/Application Support/Claude/claude_desktop_config.json' ) . ' '
                        . esc_html__( '(macOS) or', 'ai-editor-divi5' ) . ' '
                        . $code( '%APPDATA%\\Claude\\claude_desktop_config.json' ) . ' ' . esc_html__( '(Windows).', 'ai-editor-divi5' ),
                    esc_html__( 'Paste the snippet below, then fully quit and relaunch Claude Desktop (not just close the window).', 'ai-editor-divi5' ),
                    esc_html__( 'Prefer Claude Code (CLI)? Run:', 'ai-editor-divi5' ) . ' '
                        . $code( 'claude mcp add --transport http ai-editor-divi5 <MCP-URL> --header "Authorization: Bearer <KEY>"' ),
                ];
            case 'cursor':
                return [
                    esc_html__( 'Open Cursor Settings → MCP (or edit', 'ai-editor-divi5' ) . ' ' . $code( '.cursor/mcp.json' ) . ' ' . esc_html__( 'in your project).', 'ai-editor-divi5' ),
                    esc_html__( 'Add the snippet below, then use Cursor’s agent mode — plain chat mode will not call the tools.', 'ai-editor-divi5' ),
                ];
            case 'vscode':
                return [
                    esc_html__( 'Open Settings → Copilot → MCP Servers (search “MCP” if the path has moved).', 'ai-editor-divi5' ),
                    esc_html__( 'Add the snippet below, then use Copilot’s agent mode — standard chat mode will not reach the plugin.', 'ai-editor-divi5' ),
                ];
            case 'other':
            default:
                return [
                    esc_html__( 'Add the snippet below to your assistant’s MCP configuration.', 'ai-editor-divi5' ),
                    esc_html__( 'Works with Windsurf and any client that supports MCP Streamable HTTP.', 'ai-editor-divi5' ),
                ];
        }
    }
```

- [ ] **Step 5: Wire `connectCard()` into `viewSettings()` and remove `connection()`**

In `<plugin>/wp-plugin/src/AdminPage.php`, replace the Connection card block (current lines 398–424, the `<!-- Connection -->` `<div class="aied-card">…</div>`) with:

```php
        <!-- Connection -->
        <div class="aied-card">
            <h3><?php esc_html_e( 'Connect your AI assistant', 'ai-editor-divi5' ); ?></h3>
            <p class="aied-muted"><?php esc_html_e( 'Your API key authorizes your AI assistant to read and edit this site. Keep it private.', 'ai-editor-divi5' ); ?></p>
            <div class="aied-key-row">
                <code class="aied-key" id="aied-api-key" data-key="<?php echo esc_attr( $key ); ?>">••••••••••••••••••••••••</code>
                <button type="button" class="button" id="aied-toggle-key"><?php esc_html_e( 'Show', 'ai-editor-divi5' ); ?></button>
                <button type="button" class="button button-primary" data-copy="<?php echo esc_attr( $key ); ?>"><?php esc_html_e( 'Copy', 'ai-editor-divi5' ); ?></button>
                <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
                    <input type="hidden" name="action" value="ai_editor_divi5_regenerate_key">
                    <?php wp_nonce_field( 'ai_editor_divi5_regenerate_key' ); ?>
                    <button type="submit" class="button aied-btn-danger" onclick="return confirm('<?php echo esc_js( __( 'Regenerate the key? You will need to update your AI assistant.', 'ai-editor-divi5' ) ); ?>')"><?php esc_html_e( 'Regenerate', 'ai-editor-divi5' ); ?></button>
                </form>
            </div>
            <?php $this->connectCard( self::connectClients( rtrim( get_site_url(), '/' ), $key ) ); ?>
        </div>
```

Then change the top of `viewSettings()` (currently `$c = $this->connection();`) to:

```php
        $key = ApiKey::get();
```

Finally, delete the now-unused `private function connection()` method (current lines 135–148). Verify nothing else references it:

Run: `cd "<plugin>" && grep -rn 'connection()' wp-plugin/src/`
Expected: no matches (only the deleted definition existed).

- [ ] **Step 6: Add the JS init pass**

In `<plugin>/wp-plugin/assets/admin.js`, inside the `// ── LLM sub-tabs ──` section, **after** the existing `llmTabs.forEach(...)` click-handler block and before the closing `})();`, add:

```javascript
    // Initialise: activate the first tab and hide inactive panels on load.
    // Progressive enhancement — with JS disabled, no panel is hidden, so all
    // panels render stacked and remain usable.
    if (llmTabs.length) {
        var activeTab = document.querySelector('.aied-llm-tab--active') || llmTabs[0];
        activeTab.classList.add('aied-llm-tab--active');
        var activeId = 'aied-panel-' + activeTab.dataset.target;
        document.querySelectorAll('.aied-llm-panel').forEach(function (panel) {
            panel.hidden = panel.id !== activeId;
        });
    }
```

- [ ] **Step 7: Add the CSS**

In `<plugin>/wp-plugin/assets/admin.css`, append at the end of the file:

```css
/* ── Connect: assistant sub-tabs ───────────────────────── */
.aied-connect-reassure {
    font-size: 13px; color: var(--aied-muted);
    background: #f3f4f9; border: 1px solid var(--aied-line); border-radius: 8px;
    padding: 10px 12px; margin: 14px 0 12px;
}
.aied-connect-reassure strong { color: var(--aied-ink); }
.aied-llm-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin: 12px 0; border-bottom: 1px solid var(--aied-line); }
.aied-llm-tab {
    appearance: none; background: transparent; border: 0; border-bottom: 2px solid transparent;
    padding: 8px 12px; font-size: 13px; font-weight: 600; color: var(--aied-muted); cursor: pointer;
}
.aied-llm-tab:hover { color: var(--aied-ink); }
.aied-llm-tab--active { color: var(--aied-accent); border-bottom-color: var(--aied-accent); }
.aied-llm-tab:focus-visible { outline: 2px solid var(--aied-accent); outline-offset: 2px; border-radius: 4px; }
.aied-llm-panel { padding-top: 4px; }
.aied-llm-panel[hidden] { display: none; }
.aied-steps { margin: 8px 0 12px; padding-left: 20px; }
.aied-steps li { font-size: 13.5px; line-height: 1.6; padding: 3px 0; color: var(--aied-ink); }
.aied-steps code {
    background: #f3f4f9; padding: 1px 6px; border-radius: 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
}
.aied-merge-warn {
    font-size: 12.5px; color: var(--aied-warn);
    background: #fff8ec; border: 1px solid #f0d9ad; border-radius: 8px;
    padding: 9px 11px; margin: 10px 0;
}
.aied-guide-link { display: inline-block; margin-top: 4px; font-size: 13px; }
```

- [ ] **Step 8: Run the render test to verify it passes**

Run: `cd "<plugin>" && vendor/bin/phpunit --filter ConnectCardRenderTest`
Expected: PASS (6 tests).

- [ ] **Step 9: Lint the changed PHP + run the full unit suite**

Run:
```bash
cd "<plugin>"
php -l wp-plugin/src/AdminPage.php && php -l tests/bootstrap.php
vendor/bin/phpunit
```
Expected: `No syntax errors detected` for both files; full suite green (existing tests + `ConnectClientsTest` + `ConnectCardRenderTest`).

- [ ] **Step 10: Commit**

```bash
cd "<plugin>"
git add wp-plugin/src/AdminPage.php wp-plugin/assets/admin.js wp-plugin/assets/admin.css tests/bootstrap.php tests/ConnectCardRenderTest.php
git commit -m "feat(admin): tabbed per-assistant Connect panel (Claude/Cursor/VS Code/ChatGPT/Other)"
```

---

### Task 3: Fix stale `$79/yr` → `$30/yr`

**Files:**
- Modify: `<plugin>/wp-plugin/readme.txt:46`
- Modify: `<web>/content/guides/connect-claude-to-divi-5.md`
- Modify: `<web>/content/guides/connect-cursor-to-divi-5.md`
- Modify: `<web>/content/guides/connect-chatgpt-to-divi-5.md`

- [ ] **Step 1: Replace the price in all four files**

In `<plugin>/wp-plugin/readme.txt`, change `$79/year` → `$30/year` on the "Pro is an annual license" line.

In each of the three `<web>/content/guides/connect-*-to-divi-5.md` files, change `($79/yr` → `($30/yr` (the "**Pro** ($79/yr, …" sentence).

- [ ] **Step 2: Verify no stale price remains**

Run:
```bash
grep -rn '79/yr\|\$79/year\|\$79 ' "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/wp-plugin/readme.txt" "/Users/Lucas/Documents/JHMG-Local/layoutlab/content/guides/"
```
Expected: no matches.

- [ ] **Step 3: Commit (two repos)**

```bash
cd "<plugin>" && git add wp-plugin/readme.txt && git commit -m "docs: AI Editor Pro price \$79 -> \$30/yr in plugin readme"
cd "<web>" && git add content/guides/connect-claude-to-divi-5.md content/guides/connect-cursor-to-divi-5.md content/guides/connect-chatgpt-to-divi-5.md && git commit -m "docs(guides): AI Editor Pro price \$79 -> \$30/yr"
```

---

### Task 4: End-to-end verification (verification-before-completion)

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite green**

Run: `cd "<plugin>" && vendor/bin/phpunit`
Expected: OK, 0 failures/errors. Capture and show the summary line.

- [ ] **Step 2: Render walkthrough in the live plugin admin**

Using the render env (WordPress with the plugin active — see the render-env notes; `make up` in `<plugin>` if not running), open **wp-admin → AI Editor → Settings** and confirm by observation (show a screenshot or describe each):
  - The five tabs render: Claude · Cursor · VS Code · ChatGPT · Other MCP client.
  - Clicking each tab swaps the panel; only one panel is visible at a time.
  - Claude/Cursor/VS Code/Other panels show numbered steps, the snippet, a Copy button, and the merge warning; VS Code's snippet uses `"servers"` + `"type": "http"`.
  - ChatGPT panel shows the Actions steps, the `openapi.json` link, and the public-HTTPS warning (no MCP snippet).
  - The "MCP is an open standard … you don't need a Claude account" line is visible above the tabs.
  - Guide links open the correct divi5lab.com guides.

- [ ] **Step 3: No-JS fallback check**

In the browser devtools, disable JavaScript and reload the Settings page. Confirm all five panels render stacked and readable (nothing permanently hidden), so the page is still usable without JS. Re-enable JS.

- [ ] **Step 4: Verify the open items from the spec against real clients**

Confirm the shipped snippet formats actually load:
  - VS Code: paste the `"servers"`/`"type":"http"` snippet into `mcp.json` and confirm the server connects in agent mode.
  - Claude: confirm the `mcpServers` url snippet is accepted by current Claude Desktop; confirm the `claude mcp add --transport http …` command syntax is current for Claude Code. If either is wrong, correct the snippet/command in `connectClients()` / `mcpSteps()` and re-run Tasks 1–2 tests before shipping. **Do not ship a format you could not verify — link the guide instead.**

- [ ] **Step 5: Report**

Summarize what was verified with evidence (test summary line + render observations). Do not claim done without Step 1–4 evidence shown.

---

## Self-Review

**Spec coverage:**
- Tabbed client picker (5 tabs) → Task 2. ✓
- Inline essentials + guide links → Task 2 (`mcpSteps`, guide links). ✓
- 4 tabs + Other (Claude/Cursor/VS Code/ChatGPT/Other) → Task 1 keys + Task 2 tabs. ✓
- "No Claude account needed" reassurance → Task 2 (`connectCard`) + render test. ✓
- ChatGPT Actions/OpenAPI + public-HTTPS caveat → Task 2 (`connectPanelBody` actions branch) + render test. ✓
- Merge warning (documented bug) → Task 2 + render test. ✓
- Per-client snippet formats incl. VS Code `servers`/`type:http` → Task 1 + `ConnectClientsTest`. ✓
- No-JS fallback → Task 2 (no server-side `hidden`, JS init) + render test. ✓
- Price fix (4 files) → Task 3. ✓
- Testing (extend snippet tests + render smoke + no-JS) → Tasks 1, 2. ✓
- Open items verified against real clients → Task 4 Step 4. ✓

**Placeholder scan:** No TBD/TODO; all code and commands are concrete. `<plugin>`/`<web>` are path aliases defined in Global Constraints, not placeholders.

**Type consistency:** `connectClients()` return shape (`transport`/`snippet`/`guide`/`specUrl`) is produced in Task 1 and consumed identically in Task 2 (`connectCard`, `connectPanelBody`). Panel ids (`claude`/`cursor`/`vscode`/`chatgpt`/`other`) and JS selectors (`.aied-llm-tab`, `.aied-llm-panel`, `aied-panel-<id>`, `aied-llm-tab--active`, `data-target`) match the existing `admin.js` exactly.

**Note on `McpConfigSnippetTest`:** the existing test stays green (its `mcpServers` shape is unchanged — still emitted for Claude/Cursor/Other). No edit needed; new coverage lives in `ConnectClientsTest`.
