import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// 型を除いて実際の登録データを読む。アプリと監査で別のツール一覧を持たない。
// 相対パスで読み込まれる .ts / index.ts は、同じ方法で再帰的に変換して読み込む。
export function loadConfig(file = 'src/config/tools.ts', cache = new Map()) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs).exports;
  const require = createRequire(pathToFileURL(abs));
  const compiledModule = { exports: {} };
  cache.set(abs, compiledModule);
  const compiled = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (request) => {
    if (request.startsWith('.')) {
      const base = path.resolve(path.dirname(abs), request);
      for (const candidate of [base + '.ts', path.join(base, 'index.ts')]) {
        if (fs.existsSync(candidate)) return loadConfig(candidate, cache);
      }
    }
    return require(request);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, compiledModule, compiledModule.exports);
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
