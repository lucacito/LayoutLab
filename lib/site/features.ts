// Every feature of the AI Editor for Divi 5, grouped, in one place: the homepage showcase, the plugin page and the
// /divi-5-mcp page read this list. Each line is a fact about the shipped plugin (free 4.19.0, Pro 0.15.0); if a feature
// changes, change it here and in the plugin's readme together. Wording rules: say what it does, name its limit, never
// claim a result nobody measured (no "in minutes"), keep ChatGPT as "not yet confirmed with a real account".
import { AI_EDITOR } from './ai-editor-facts';

export type FeatureTier = 'free' | 'pro';

export type Feature = {
  icon: string;
  title: string;
  body: string;
  tier: FeatureTier;
  /** Short flag such as "New in 4.18". */
  flag?: string;
};

export type FeatureGroup = {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  features: Feature[];
};

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'edit',
    eyebrow: 'Edit',
    title: 'Change any Divi 5 page in plain English',
    lead: 'Your assistant reads the real page, changes only what you asked for and saves it checked. Pages and Divi Projects, from one chat.',
    features: [
      { icon: 'manage_search', tier: 'free', title: 'List, read and outline pages', body: 'See every Divi 5 page and Divi Project, read one in full or as a short outline, and let the assistant open just the block it needs.' },
      { icon: 'edit_note', tier: 'free', title: 'Edit one sentence or a whole layout', body: 'Change a phone number, a price or a heading without rebuilding the page, or save a new layout once the checker approves it.' },
      { icon: 'drive_file_rename_outline', tier: 'free', title: 'Rename pages', body: 'Change the title of a page or Project on its own or together with the layout. The reply says plainly that a rename is not undoable.' },
      { icon: 'note_add', tier: 'free', title: 'New pages are always drafts', body: 'Nothing goes live until you publish it yourself. Create a page, review it, then publish.' },
      { icon: 'code', tier: 'free', title: 'Turn HTML into Divi 5', body: 'Hand over HTML and get a Divi 5 layout back with an honest report of what was kept and what was left out. No AI and no network involved.' },
      { icon: 'view_in_ar', tier: 'free', title: 'Divi 5.15 Components aware', body: 'The assistant sees which sections are shared Components and warns when an edit would change every page that uses one.' },
    ],
  },
  {
    id: 'lab',
    eyebrow: 'Lab',
    title: 'Answer a few questions. Get a draft page.',
    lead: 'Lab is a tab in the plugin for building a page without writing a prompt. It is new in 4.19, and it uses the same proven section layouts and the same validator as everything else.',
    features: [
      { icon: 'dashboard_customize', tier: 'free', flag: 'New in 4.19', title: 'A guided page builder', body: 'Say what the page is for, choose the look and the sections, then add your words and pictures. Lab builds the page from the plugin\'s proven section layouts.' },
      { icon: 'preview', tier: 'free', flag: 'New in 4.19', title: 'A live preview while you answer', body: 'See the page take shape before anything is saved. Saving creates a draft; nothing is published until you publish it.' },
      { icon: 'verified', tier: 'free', flag: 'New in 4.19', title: 'Checked like every other change', body: 'A page built in Lab passes the same validator as an edit made by your assistant, so a broken layout is not saved.' },
      { icon: 'forum', tier: 'free', flag: 'New in 4.19', title: 'Let your assistant write the words', body: 'The lab_build tool lets your own AI assistant fill in the words of a Lab brief, or build a page from a short brief. It is always a draft and never overwrites what you changed meanwhile. Lab is new, and results with any given assistant are not yet confirmed.' },
    ],
  },
  {
    id: 'loops',
    eyebrow: 'Dynamic content',
    title: 'Build lists that fill themselves',
    lead: 'Divi 5 Loop Builder support: a card, a row or an image that repeats once per post, product, category, user or menu item.',
    features: [
      { icon: 'repeat', tier: 'free', flag: 'New in 4.18', title: 'Loop Builder, built in', body: 'Newest posts, all posts in pages with Next and Previous links, your categories, your newest WooCommerce products. Ready-made patterns follow your design.' },
      { icon: 'visibility', tier: 'free', flag: 'New in 4.18', title: 'See what a loop will list first', body: 'Before a page is saved the assistant gets a short report for each loop: how many items match on your site and the first titles. It flags a post type, menu or term your site does not have.' },
      { icon: 'gpp_good', tier: 'free', flag: 'New in 4.18', title: 'Refuses loops that break the page', body: 'Settings that make Divi fail the whole page, or quietly list the wrong things, are refused with the exact setting to fix.' },
    ],
  },
  {
    id: 'safe',
    eyebrow: 'Safe',
    title: 'The AI drafts. A fixed check decides.',
    lead: 'Not a second AI and not a vibe check: the same layout always gets the same verdict, and a broken layout is never saved by an AI edit.',
    features: [
      { icon: 'verified', tier: 'free', title: 'A deterministic validator', body: `Every layout is checked block by block against ${AI_EDITOR.blockTypes} Divi 5 block types, built from real Divi exports and live renders. A refusal names the exact violation so the assistant fixes its own mistake.` },
      { icon: 'preview', tier: 'free', title: 'Preview before saving', body: 'Ask for a dry run to see exactly what would change. Approval mode makes a preview mandatory before any page edit.' },
      { icon: 'undo', tier: 'free', title: 'Undo for AI edits', body: 'The previous version of each page is kept (the last 10), including changes made by other tools. Restore from the dashboard or ask your assistant.' },
      { icon: 'shield', tier: 'free', title: 'No custom code through a layout', body: 'A page layout can never carry custom CSS, JavaScript or PHP, and the plugin never runs code on your server.' },
    ],
  },
  {
    id: 'design',
    eyebrow: 'Design',
    title: 'Pages that look designed, not assembled',
    lead: 'Guidance that steers the assistant toward real, readable Divi 5 pages instead of generic ones.',
    features: [
      { icon: 'dashboard_customize', tier: 'free', title: `${AI_EDITOR.sectionPatterns} proven section patterns`, body: 'Heroes, pricing, testimonials, forms, loops and more. Each one is re-checked by the validator and filterable by role, layout and mood.' },
      { icon: 'palette', tier: 'free', title: `${AI_EDITOR.designLanguages} design languages`, body: 'Colours and fonts by role, with readable text proven for every pairing, so a page keeps one consistent look.' },
      { icon: 'style', tier: 'free', title: `${AI_EDITOR.styleKits} style kits`, body: 'Buttons, cards, accordions, forms, dividers and tags that match in every language. Pick a kit once and every control agrees.' },
      { icon: 'contrast', tier: 'free', title: 'A design check', body: 'An advisory look at text nobody can read, Divi\'s grey stock placeholders and repeated sections. It advises and never blocks a save.' },
      { icon: 'image', tier: 'free', title: `${AI_EDITOR.builtInImages} original images included`, body: 'The assistant looks in your Media Library first, then uses the built-in pack. No third-party image host.' },
    ],
  },
  {
    id: 'site',
    eyebrow: 'Your site',
    title: 'It knows how your site is set up',
    lead: 'Read-only, so the copy and the structure fit what you actually have.',
    features: [
      { icon: 'dns', tier: 'free', title: 'Post types, taxonomies and image sizes', body: 'Plus, on request, the ids of your navigation lists and most used categories and tags, so a list can name them.' },
      { icon: 'database', tier: 'free', title: 'ACF and custom fields', body: 'Reads field groups and the values of a page you can edit, and binds a text, image or button link to a field so the page shows live values.' },
      { icon: 'format_color_fill', tier: 'free', title: 'Your colours, presets and variables', body: 'The assistant reuses your global colours and presets and is warned when it names one your site does not have.' },
      { icon: 'shopping_bag', tier: 'free', title: 'WooCommerce products, read-only', body: 'List and filter your catalogue, open a product in full. Nothing is changed in the free plugin.' },
    ],
  },
  {
    id: 'connect',
    eyebrow: 'Connect',
    title: 'Works with the assistant you already use',
    lead: 'You bring your own AI. The plugin adds the tools and the safety net, with no AI credits to run out.',
    features: [
      { icon: 'hub', tier: 'free', title: 'An MCP server for Divi 5', body: 'Claude Desktop, Claude Code, Cursor, Windsurf and VS Code Copilot connect over MCP. A REST API serves anything else.' },
      { icon: 'login', tier: 'free', title: 'Sign in from Claude on the web', body: 'An optional OAuth sign-in for claude.ai custom connectors, with no Node.js to install. Off until you turn it on.' },
      { icon: 'chat', tier: 'free', title: 'ChatGPT custom connector', body: 'ChatGPT can connect as a custom MCP connector that signs in with your WordPress login. Not yet confirmed with a real ChatGPT account.' },
      { icon: 'extension', tier: 'free', title: 'WordPress Abilities', body: 'On WordPress 6.9+ the design guidance, the check and the undo are offered as abilities any AI can call, designed to work alongside Divi\'s upcoming MCP.' },
      { icon: 'network_check', tier: 'free', title: 'Test connection', body: 'One button in the settings tells you in plain English whether your assistant can reach the site.' },
    ],
  },
  {
    id: 'pro',
    eyebrow: 'Pro',
    title: 'Work across the whole site',
    lead: `${AI_EDITOR.proTools} more tools for the work around the page. Every change is one undoable step, with the limits stated.`,
    features: [
      { icon: 'rocket_launch', tier: 'pro', title: 'Build and launch a whole site', body: 'Add pages one by one as checked drafts, then launch: publish, set the front page and build the main menu in one previewed step. Pages can come from Lab briefs, so the whole site shares one look and the pages show up in Lab.', flag: 'Updated in 0.15' },
      { icon: 'brush', tier: 'pro', flag: 'New in 0.15', title: 'Restyle Lab pages', body: 'Rebuild the pages Lab made in another design language or style kit. Previewed first, undoable, and any page you edited since is skipped.' },
      { icon: 'auto_awesome', tier: 'pro', title: 'Restyle in one call', body: 'Switch a page, or up to 25, to another design language and style kit. Previewed first, no AI involved, and one undo puts every page back.' },
      { icon: 'web', tier: 'pro', title: 'Theme Builder header, footer and body', body: 'Edit the live header, footer and body layouts and assign templates, checked and undoable like any page.' },
      { icon: 'menu_open', tier: 'pro', title: 'Mega menu layouts', body: '14 ready-made mega menu layouts for your header, applied in one click and still editable in Divi.' },
      { icon: 'find_replace', tier: 'pro', title: 'Find and replace across the site', body: 'Change a price or a sentence on every page as one undoable batch, with a preview first.' },
      { icon: 'fact_check', tier: 'pro', title: 'Site audit', body: 'Read-only check for layout problems, unknown colours and presets, and links to missing or unpublished pages.' },
      { icon: 'tune', tier: 'pro', title: 'Colours, variables and presets', body: 'Create and change global colours, number and text variables and module presets so pages are built with your own tokens.' },
      { icon: 'shopping_cart', tier: 'pro', title: 'WooCommerce products and prices', body: 'Create draft products, change existing ones and adjust prices in bulk with the shop\'s own rounding, all undoable.' },
      { icon: 'home_work', tier: 'pro', title: 'Front page, menu and custom fields', body: 'Publish pages, set the front page and primary menu, and fill in custom field values.' },
    ],
  },
];

export function featureCount(): number {
  return FEATURE_GROUPS.reduce((n, g) => n + g.features.length, 0);
}
