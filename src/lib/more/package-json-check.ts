import semver from "semver";

import type { T } from "./types";

export type PkgFinding = { level: "error" | "warn" | "info"; target: string; message: string };

const SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
const DEV_ONLY = /^(typescript|eslint(-.*)?|prettier|jest|vitest|mocha|webpack(-cli)?|rollup|vite|@types\/.+|ts-node|nodemon|husky|lint-staged|@babel\/.+|babel-.+|cypress|playwright|@playwright\/test|storybook|tsx)$/;
const NON_SEMVER = /^(file:|link:|workspace:|git\+|git:|github:|https?:|npm:|portal:|patch:|[\w.-]+\/[\w.-]+(#.*)?$)/;

export function checkPackageJson(json: string, t: T): PkgFinding[] {
  const pkg = JSON.parse(json) as Record<string, unknown> & Partial<Record<(typeof SECTIONS)[number], Record<string, string>>>;
  const f: PkgFinding[] = [];
  const add = (level: PkgFinding["level"], target: string, ja: string, en: string) => f.push({ level, target, message: t(ja, en) });
  const seen = new Map<string, { section: string; range: string }[]>();
  for (const s of SECTIONS) for (const [name, range] of Object.entries(pkg[s] ?? {})) (seen.get(name) ?? seen.set(name, []).get(name)!).push({ section: s, range });

  for (const [name, uses] of seen) {
    const sections = uses.map((u) => u.section);
    const dd = uses.filter((u) => u.section === "dependencies" || u.section === "devDependencies");
    if (dd.length === 2) {
      if (dd[0].range === dd[1].range) add("warn", name, "dependencies と devDependencies の両方に同じ範囲で書かれています。どちらかを削除してください。", "Listed in both dependencies and devDependencies with the same range. Remove one.");
      else add("error", name, `dependencies（${dd[0].range}）と devDependencies（${dd[1].range}）で範囲が異なります。`, `Different ranges in dependencies (${dd[0].range}) and devDependencies (${dd[1].range}).`);
    }
    if (sections.includes("peerDependencies") && !sections.includes("devDependencies") && !sections.includes("dependencies")) add("info", name, "peerDependencies だけにあり、開発・テスト用の devDependencies にはありません。", "Only in peerDependencies, not in devDependencies for development and testing.");
    for (const { section, range } of uses) {
      if (section === "peerDependencies") continue;
      if (range === "*" || range === "" || range === "latest" || range === "x") add("warn", name, `範囲 "${range || "(空)"}" は任意のバージョンを許すため、再現性がありません。`, `The range "${range || "(empty)"}" allows any version and is not reproducible.`);
      else if (NON_SEMVER.test(range)) add("info", name, `${range} はnpmレジストリのsemver範囲ではありません（git・URL・ローカルパス等）。`, `${range} is not an npm registry semver range (git, URL, local path, etc.).`);
      else if (semver.validRange(range) === null) add("error", name, `範囲 "${range}" が不正です。`, `The range "${range}" is invalid.`);
      else if (/^[\^~]?0\.0\./.test(range) || /^\^0\.\d+/.test(range)) add("info", name, `${range} は0.x系のため、${/^\^0\.0/.test(range) ? "パッチ" : "マイナー"}更新でも破壊的変更が入りえます。`, `${range} is a 0.x version, where even ${/^\^0\.0/.test(range) ? "patch" : "minor"} updates may contain breaking changes.`);
      if (section === "dependencies" && DEV_ONLY.test(name)) add("warn", name, "開発用ツールが dependencies にあります。devDependencies に移すことを検討してください。", "A development tool is in dependencies. Consider moving it to devDependencies.");
    }
  }
  if (!pkg.license) add("info", "license", "license フィールドがありません。", "The license field is missing.");
  if (!pkg.engines) add("info", "engines", "engines がなく、対応するNode.jsのバージョンが示されていません。", "There is no engines field, so supported Node.js versions are not stated.");
  if (pkg.private !== true && !pkg.version) add("warn", "version", "version がありません。公開するには必要です。", "version is missing. It is required to publish.");
  if (pkg.main && pkg.exports === undefined && pkg.type === undefined && pkg.module) add("info", "exports", "main と module がありますが exports がありません。新しいツールでは exports の指定が推奨です。", "main and module are present but exports is not. Modern tooling prefers exports.");
  if (!f.length) add("info", "-", "目立った問題は見つかりませんでした。", "No obvious problems found.");
  return f;
}
