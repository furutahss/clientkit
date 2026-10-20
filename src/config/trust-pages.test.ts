import { describe, expect, it } from 'vitest';
import { trustPages } from './trust-pages';

describe('信頼性ページ', () => {
  it('日英で全4ページがあり、運営者の個人情報を捏造しない', () => {
    expect(Object.keys(trustPages)).toEqual(['about', 'operator', 'contact', 'terms']);
    for (const page of Object.values(trustPages)) for (const lang of ['ja', 'en'] as const) {
      expect(page.title[lang].length).toBeGreaterThan(0);
      expect(page.sections.every(s => s.heading[lang] && s.paragraphs.every(p => p[lang]))).toBe(true);
    }
    const content = JSON.stringify(trustPages);
    for (const field of ['NAME', 'EMAIL', 'ADDRESS']) expect(content).toContain(`TODO_OPERATOR_${field}`);
    expect(content).not.toMatch(/support@clientkit|info@clientkit/);
  });
});
