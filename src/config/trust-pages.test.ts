import { describe, expect, it } from 'vitest';
import { trustPages } from './trust-pages';
import { privacyPolicySections } from './privacy-policy';

describe('信頼性ページ', () => {
  it('日英で全4ページがあり、運営者の個人情報を捏造しない', () => {
    expect(Object.keys(trustPages)).toEqual(['about', 'operator', 'contact', 'terms']);
    for (const page of Object.values(trustPages)) for (const lang of ['ja', 'en'] as const) {
      expect(page.title[lang].length).toBeGreaterThan(0);
      expect(page.sections.every(s => s.heading[lang] && s.paragraphs.every(p => p[lang]))).toBe(true);
    }
    const content = JSON.stringify({ trustPages, privacyPolicySections });
    expect(content).toContain('furutahss');
    expect(content).toContain('contact@furutahss.com');
    expect(content).not.toContain('TODO_OPERATOR_');
    for (const lang of ['ja', 'en'] as const) {
      const operator = trustPages.operator.sections.flatMap(s => s.paragraphs.map(p => p[lang])).join(' ');
      expect(operator).toContain('furutahss');
      expect(operator).toContain('contact@furutahss.com');
      expect(operator).not.toMatch(/所在地|住所|Published location/);
    }
    expect(content).not.toMatch(/support@clientkit|info@clientkit/);
  });
});
