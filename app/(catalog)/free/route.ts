import { permanentRedirect } from 'next/navigation';

// /free is the memorable URL; /free-divi-layouts is the canonical free hub
// (it carries the keyword). One page, one URL — no duplicate-content split.
export function GET() {
  permanentRedirect('/free-divi-layouts');
}
