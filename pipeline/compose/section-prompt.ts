import type { Brief } from './brief';
import type { Step } from './flow';

// Composition text placed into a synthesized section Target's `layout`, so
// buildGenerationPrompt grounds the section on its recipe while every section
// shares the same brand (name, accent, CTA, voice) — the cohesion mechanism.
export function buildSectionRolePrompt(step: Step, brief: Brief): string {
  const lines = [
    `This section is part of ONE cohesive landing page for "${brief.businessName}" (${brief.businessType}).`,
    `Audience: ${brief.audience}. Voice: ${brief.voice}.`,
    `Use the accent color ${brief.accentColorHex} for the primary button, icons, and highlights — the SAME accent across the whole page.`,
    `Section role: ${step.job}`,
    'Write specific, benefit-led copy in second person; no lorem ipsum; bracket any placeholder facts like "[Replace: client name]".',
  ];
  if (step.cta) {
    lines.push(`Include the primary CTA button labelled exactly "${brief.primaryCta}" (the one action for the whole page).`);
  } else {
    lines.push('Do not add a competing call-to-action button in this section.');
  }
  return lines.join(' ');
}
