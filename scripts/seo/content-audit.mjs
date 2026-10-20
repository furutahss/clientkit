import fs from 'node:fs';
import assert from 'node:assert/strict';
import { tools, body, count, words, grams, similarity } from './data.mjs';

assert.equal(count('あ 😀\nA'), 3);
assert.equal(similarity(grams('abcdef'), grams('abcdef')), 1);
assert.equal(similarity(grams('abcdef'), grams('uvwxyz')), 0);
const baseline = process.argv.includes('--baseline');
if (!baseline) {
  // JSONのdefault importを監査ローダーが落としていないことも確認する。
  for (const file of fs.readdirSync('src/content/tool-guides')) {
    const guides = JSON.parse(fs.readFileSync(`src/content/tool-guides/${file}`, 'utf8'));
    for (const [id, guide] of Object.entries(guides)) for (const lang of ['ja', 'en']) {
      assert.ok(body(tools.find(tool => tool.id === id), lang).includes(guide[lang][0]), `${id}: 追加解説が計測対象から欠落`);
    }
  }
}
const rows = [];
const failures = [];
const similarities = [];
for (const lang of ['ja', 'en']) {
  const titles = new Set(), descriptions = new Set();
  for (const tool of tools) {
    const text = body(tool, lang);
    const chars = count(text), wordCount = words(text);
    const unique = tool.about.paragraphs[lang].some(p => !tools.some(t => t.id !== tool.id && t.about.paragraphs[lang].includes(p)));
    rows.push(`| /${lang}/tools/${tool.id} | ${chars} | ${lang === 'en' ? wordCount : '—'} | ${unique ? 'あり' : 'なし'} | ${tool.faq.length} |`);
    if ((lang === 'ja' ? chars < 600 : wordCount < 200) || !unique || tool.faq.length < 3 || tool.faq.length > 5) failures.push(`${lang}/${tool.id}: 本文・FAQ基準未達 (${chars}字/${wordCount}語)`);
    const description = tool.longDescription?.[lang] ?? tool.description[lang];
    if (titles.has(tool.name[lang]) || descriptions.has(description)) failures.push(`${lang}/${tool.id}: メタ情報重複`);
    titles.add(tool.name[lang]); descriptions.add(description);
  }
  const sets = tools.map(t => grams(body(t, lang)));
  for (let i = 0; i < tools.length; i++) for (let j = i + 1; j < tools.length; j++) {
    const score = similarity(sets[i], sets[j]);
    similarities.push({ lang, a: tools[i].id, b: tools[j].id, score });
    if (score > 0.55) failures.push(`${lang}: ${tools[i].id} / ${tools[j].id}: 類似度 ${score.toFixed(3)}`);
  }
}
similarities.sort((a,b) => b.score - a.score);
const report = `\n## ${baseline ? '改善前' : '改善後'}の本文計測\n\n計測対象: ${tools.length}ツール × 2言語。使い方・解説・FAQの可視テキストを対象とし、ナビ・UIラベル・JSON-LDは除外。文字数は空白を除くUnicodeコードポイント数。基準は日本語600字以上、英語200語以上（内容の同等性は実装との照合で別途確認）。600〜1200字は目安とし、有用な既存説明は削らない。独自本文は他ツールと完全一致しない解説段落の有無。類似度は同一言語の全組合せで、記号・空白除去後の文字5-gram Dice係数、上限0.55。\n\n| URL | 本文字数 | 英語語数 | 独自解説 | FAQ数 |\n| --- | ---: | ---: | --- | ---: |\n${rows.join('\n')}\n\n最も類似する組: ${similarities.slice(0,5).map(s => `${s.lang}: ${s.a} / ${s.b} = ${s.score.toFixed(3)}`).join('; ')}。\n\n基準未達: ${failures.length}件。\n${failures.map(f => '- ' + f).join('\n')}\n`;
if (process.argv.includes('--write') || baseline) fs.appendFileSync('docs/seo-audit.md', report.trimEnd() + '\n');
fs.writeFileSync('/private/tmp/clientkit-content-audit.json', JSON.stringify({toolCount:tools.length, failures, similarities:similarities.slice(0,10)},null,2));
console.log(`${tools.length * 2}ページ計測、未達${failures.length}件、最大類似度${similarities[0].score.toFixed(3)}`);
if (!baseline && failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
