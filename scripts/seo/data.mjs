import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// 型を除いて実際の登録データを読む。アプリと監査で別のツール一覧を持たない。
export function loadConfig(file = 'src/config/tools.ts') {
  const require = createRequire(new URL('../../' + file, import.meta.url));
  const compiledModule = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
export const { tools, categories } = loadConfig();
export function body(tool, lang) {
  return [...tool.howToUse[lang], ...tool.about.paragraphs[lang],
    ...tool.faq.flatMap(f => [f.question[lang], f.answer[lang]])].join('\n');
}
export const count = text => [...text.replace(/\s/g, '')].length;
export const words = text => text.match(/\b[\w'-]+\b/g)?.length ?? 0;
export function grams(text) {
  const clean = text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  return new Set(Array.from({ length: Math.max(0, clean.length - 4) }, (_, i) => clean.slice(i, i + 5)));
}
export function similarity(a, b) {
  const intersection = [...a].filter(x => b.has(x)).length;
  return a.size + b.size ? 2 * intersection / (a.size + b.size) : 0;
}
