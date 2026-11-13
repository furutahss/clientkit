import { describe, expect, it } from 'vitest';
import { tools } from './tools';
import textMedia from '@/content/tool-guides/text-media.json';
import dataSecurity from '@/content/tool-guides/data-security.json';
import development from '@/content/tool-guides/development.json';
import { moreGuides } from './more-tools';

const guides = { ...textMedia, ...dataSecurity, ...development, ...moreGuides } as Record<string, { ja: string[]; en: string[] }>;
describe('全ツールの固有例と制限', () => {
  it('公開ツールすべてに日英の追加解説を表示する', () => {
    expect(Object.keys(guides).sort()).toEqual(tools.map(t => t.id).sort());
    for (const tool of tools) for (const lang of ['ja', 'en'] as const) {
      const guide = guides[tool.id];
      expect(guide[lang]).toHaveLength(2);
      for (const paragraph of guide[lang]) expect(tool.about.paragraphs[lang]).toContain(paragraph);
    }
  });
});
