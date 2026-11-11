// Verifiable numbers about the AI Editor for Divi 5 that more than one page quotes. Source: the plugin repo
// ("Divi 5 Deterministic Validator") at the free 4.19.0 / Pro 0.15.0 release. Update the source, then this file; never invent.
import { STATS } from './stats';

export const AI_EDITOR = {
  /** Free plugin on WordPress.org (readme Stable tag). */
  freeVersion: '4.19.0',
  /** Pro add-on in the divi5lab store. */
  proVersion: '0.15.0',
  /** Tools in the free plugin (wp-plugin/readme.txt). */
  freeTools: 22,
  /** Tools in the Pro add-on (pro-addon/README.md, src/Tools/). */
  proTools: 24,
  /** divi/* block types the validator models (SchemaRules). */
  blockTypes: STATS.validatorBlockTypes,
  /** Ready-made section patterns (SectionRecipes::count()). */
  sectionPatterns: 75,
  designLanguages: 10,
  styleKits: 40,
  /** Original images shipped in the plugin (wp-plugin/assets/images/manifest.json). */
  builtInImages: 44,
  /** The Divi release the plugin was last tested against. */
  testedDivi: '5.15.1',
  wordpressOrgUrl: 'https://wordpress.org/plugins/jhmg-ai-editor-for-divi-5/',
} as const;
