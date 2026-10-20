import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToolDirectory } from './tool-directory';
import { RelatedTools } from '@/components/tools/related-tools';
import { categories, tools } from '@/config/tools';

describe('検索やJavaScriptに依存しないツールへの到達性', () => {
  it.each(['ja', 'en'] as const)('%sのカテゴリ別一覧に全ツールがある', lang => {
    const html = renderToStaticMarkup(createElement(ToolDirectory, { lang }));
    for (const tool of tools) expect(html).toContain(`href="/${lang}/tools/${tool.id}"`);
    for (const category of categories) expect(html).toContain(`id="category-${category.id}"`);
  });
  it('各ツールから自身を除く関連するツールへ直接リンクする', () => {
    for (const tool of tools) {
      const html = renderToStaticMarkup(createElement(RelatedTools, { tool, lang: 'ja' }));
      expect(html).not.toContain(`href="/ja/tools/${tool.id}"`);
      expect((html.match(/href=/g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });
});
