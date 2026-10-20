import { describe, expect, it } from 'vitest';
import { localizedAlternates } from './seo';

describe('正規URLと言語対応', () => {
  it('各ツール自身の日英URLと日本語x-defaultを返す', () => {
    expect(localizedAlternates('en', '/tools/base64')).toEqual({
      canonical: 'https://clientkit.dev/en/tools/base64',
      languages: { ja: 'https://clientkit.dev/ja/tools/base64', en: 'https://clientkit.dev/en/tools/base64', 'x-default': 'https://clientkit.dev/ja/tools/base64' },
    });
  });
  it('ホームも同じ規則を使う', () => {
    expect(localizedAlternates('ja').canonical).toBe('https://clientkit.dev/ja');
  });
});
