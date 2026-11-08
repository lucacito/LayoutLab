// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeatureShowcase } from '@/components/marketing/FeatureShowcase';
import { FEATURE_GROUPS, featureCount } from '@/lib/site/features';
import { AI_EDITOR } from '@/lib/site/ai-editor-facts';
import { HOME_TESTIMONIALS } from '@/lib/site/testimonials';

describe('feature list data', () => {
  it('has unique titles, a tier on every feature and no claim nobody measured', () => {
    const all = FEATURE_GROUPS.flatMap((g) => g.features);
    expect(new Set(all.map((f) => f.title)).size).toBe(all.length);
    for (const f of all) {
      expect(['free', 'pro']).toContain(f.tier);
      expect(f.body.length).toBeGreaterThan(40);
    }
    const text = all.map((f) => `${f.title} ${f.body}`).join(' ').toLowerCase();
    expect(text).not.toMatch(/in minutes|best on the market|guaranteed/);
    // ChatGPT stays "not yet confirmed" until a real account has been tried
    expect(text).toMatch(/not yet confirmed with a real chatgpt account/);
  });

  it('uses the shared counts, not typed-in numbers', () => {
    const text = FEATURE_GROUPS.flatMap((g) => [g.title, g.lead, ...g.features.flatMap((f) => [f.title, f.body])]).join(' ');
    expect(text).toContain(`${AI_EDITOR.sectionPatterns} proven section patterns`);
    expect(text).toContain(`${AI_EDITOR.designLanguages} design languages`);
    expect(text).toContain(`${AI_EDITOR.styleKits} style kits`);
    expect(text).toContain(`${AI_EDITOR.proTools} more tools`);
  });

  it('puts only Pro features in the Pro group and none of them in the free groups', () => {
    for (const g of FEATURE_GROUPS) {
      const tiers = new Set(g.features.map((f) => f.tier));
      expect(tiers.size).toBe(1);
      expect(tiers.has(g.id === 'pro' ? 'pro' : 'free')).toBe(true);
    }
  });
});

describe('<FeatureShowcase />', () => {
  it('renders every group with an anchor and every feature once', () => {
    render(<FeatureShowcase />);
    expect(screen.getByRole('heading', { name: /the complete ai toolkit for divi 5/i })).toBeTruthy();
    for (const g of FEATURE_GROUPS) {
      expect(document.getElementById(`features-${g.id}`)).toBeTruthy();
      expect(document.querySelector(`a[href="#features-${g.id}"]`)).toBeTruthy();
    }
    expect(document.querySelectorAll('li').length).toBe(featureCount());
    expect(screen.getByText(/loop builder, built in/i)).toBeTruthy();
  });
});

describe('testimonials', () => {
  it('are exact words from the customer, credited, and say nothing personal', () => {
    for (const t of HOME_TESTIMONIALS) {
      expect(t.name).toBe('Marva Lord');
      expect(t.business).toBe('Griots Arts Ltd');
      expect(t.quote).not.toMatch(/adhd|autis|diagnos|neuro/i);
      expect(t.quote).not.toMatch(/divi cake/i);
    }
  });
});
