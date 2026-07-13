// Real, verifiable marketing numbers. Every figure has a source; update the
// source, then this file — never invent.
import { WIDGET_TYPES_MAPPED } from './widget-mappings';

export const STATS = {
  /** registerWidget() calls in the E→D5 converter registry (see widget-mappings.ts). */
  elementorWidgetsMapped: WIDGET_TYPES_MAPPED,
  /** D→E converter module coverage (established claim, plugin README). */
  diviModulesMapped: 35,
  /** E_* violation-code constants in Divi5Validator/src/Validator.php. */
  validatorViolationClasses: 15,
  /** divi/* block types modeled in Divi5Validator/src/SchemaRules.php. */
  validatorBlockTypes: 61,
  /** Floor of published layouts on prod (198 on 2026-07-12, via sitemap). */
  freeLayoutsPublished: 190,
  /** wordpress.org active installs floor for the E→D5 free plugin. */
  activeInstalls: 100,
} as const;
