// Generate ONE full-landing page for a radiology imaging center — a CLEAN CLINICAL
// look (light, calm, generous whitespace, a single blue/teal accent), whose ONE
// action is "Request an Appointment". Catalog content: the brand is fictional-but-
// realistic with placeholder contact facts a buyer swaps for their own.
//
// Reuses the theme pipeline (composeLanding + validate → images → stack → dedupe →
// SEO → upload → render → ingest) for a single page — no pack assembly.
//
// Run: bash scripts/gen-radiology-landing.sh   (sources env, runs this)
import { buildThemeDeps } from '@/pipeline/deps';
import { runThemePack, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

const BRIEF: Brief = {
  businessType: 'local business',
  businessName: 'Meridian Imaging',
  tagline: 'Advanced medical imaging, close to home',
  audience:
    'patients whose doctor has ordered a scan — and the referring physicians who send them — ' +
    'who want an accurate result, a calm experience, and fast turnaround',
  conversionGoal: 'request an appointment',
  primaryCta: 'Request an Appointment',
  accentColorHex: '#0E7C86', // calm clinical teal, used sparingly on light backgrounds
  voice:
    'calm, clear, and credentialed — reassuring without hype. Short, plain-language sentences a ' +
    'nervous patient understands. Trustworthy and precise. Never salesy, never alarming. ' +
    'Lead with accuracy, comfort, and speed.',
  // Shared design system carried across every section (clean clinical): a calm
  // teal primary + a clinical blue secondary on light backgrounds, a soft slate
  // tint for the alternating panels, a deep-slate dark panel, slate type.
  palette: {
    primary: '#0E7C86',
    secondary: '#1F6FB2',
    tint: '#F1F5F9',
    dark: '#0F172A',
    heading: '#0F172A',
    body: '#334155',
  },
  designNotes:
    'clean and clinical — bright, generous whitespace, soft rounded cards with one consistent radius and a ' +
    'single soft shadow, thin dividers, a single calm accent used sparingly. Trustworthy, precise, uncluttered — never loud',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, address, phone, email, ' +
  'accreditation or booking appears, and NEVER invent alternatives or a second phone number: ' +
  'Name: Meridian Imaging. A community outpatient radiology & imaging center offering the full range of ' +
  'modalities under one roof: MRI (high-field, wide-bore), CT (low-dose), digital X-ray, ultrasound, ' +
  '3D mammography, and PET/nuclear medicine. ACR-accredited; board-certified, subspecialty radiologists; ' +
  'most results sent to your doctor within 24 hours; most insurance accepted; easy on-site parking. ' +
  'Phone: (312) 555-0142. Email: appointments@meridianimaging.com. Address: 240 Parkview Avenue, Suite 100, ' +
  'Chicago, IL 60601. Hours: Mon–Fri 7:00am–7:00pm; Sat 8:00am–2:00pm; closed Sunday. ' +
  'Aesthetic: CLEAN and CLINICAL — light backgrounds (#FFFFFF and soft #F8FAFC panels), dark slate text ' +
  '(#0F172A), a SINGLE calm teal accent (#0E7C86) used sparingly on buttons and highlights, generous ' +
  'whitespace, soft rounded cards, no clutter. Trustworthy, precise, and calm — never loud.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

const PAGE: ThemePage = {
  role: 'landing', roleLabel: 'Landing',
  flow: [
    S('hero', 'hero', 'Open calm and clinical: a reassuring headline about accurate, comfortable imaging close to home. Say who it is for (patients whose doctor ordered a scan) and the ONE action — Request an Appointment — over a bright, clean facility or scanner image. Light, spacious, a single teal accent.', true),
    S('trust', 'features', 'A quiet credibility strip / short trust row: ACR-accredited, board-certified subspecialty radiologists, most results to your doctor within 24 hours, most insurance accepted. Plain, factual, reassuring — no hype.'),
    S('services', 'cards', 'The imaging services / modalities as clean cards — MRI (high-field, wide-bore), CT (low-dose), Digital X-ray, Ultrasound, 3D Mammography, and PET/Nuclear Medicine. Each card: the modality name and a one-line, plain-language note on what it is used for. Calm, precise copy.', true),
    S('why', 'features', 'Why patients choose Meridian: the experience and outcomes — accurate subspecialty reads, low-dose technology, short wait times, a comfortable wide-bore environment for anxious patients, fast results to your doctor, easy parking. Sell reassurance and accuracy, not features.'),
    S('how_it_works', 'cards', 'How it works in 3 simple steps: 1) Request an appointment (bring your doctor’s order), 2) Come in for your scan, 3) Your results are sent to your physician. Make it feel easy and low-stress.'),
    S('gallery', 'gallery', 'Bright, reassuring photography of the facility, the imaging equipment, and calm staff — clean, light, high-trust. Not clinical-cold; welcoming.'),
    S('referral', 'features', 'For referring physicians: refer with confidence. A streamlined referral process (simple fax or online order), rapid subspecialty read turnaround, and patient-first scheduling so your care plans keep moving. Include a compact “Refer a Patient” contact card with the phone/email and a secondary action. Speak to the doctor, not the patient, here.'),
    S('faq', 'faq', 'Answer the real patient questions: Do I need a referral? Is it safe / how much radiation? How should I prepare? Will my insurance cover it? How fast will my doctor get results? Reassuring, plain-language answers.'),
    S('social_proof', 'testimonials', '2–3 short patient quotes about a calm experience, kind staff, and fast results (bracketed placeholders, never fabricated as real).', true),
    S('final_cta', 'cta', 'Restate the promise and the one action: Request an Appointment. Calm, clean, minimal — one clear button, contact details nearby.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'medical', style: 'minimal', color: 'light', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function main() {
  // Followups #1: shared factory (pipeline/deps.ts) wires the SAME real gates
  // `npm run pipeline` gets — visionCritic, nearDuplicateHashes (excluding this
  // pack's own pages), onEvent, and the T2.1 render-outcome contract — instead
  // of a hand-rolled deps object that silently lacked all four.
  const { deps, close } = await buildThemeDeps({ businessName: BRIEF.businessName, logPrefix: '[radiology]', defaultMaxBudgetUsd: 4 });

  console.log(`[radiology] generating the Meridian Imaging clean-clinical radiology landing page…`);
  const result = await runThemePack(SPEC, deps);
  await close();
  console.log('[radiology] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
