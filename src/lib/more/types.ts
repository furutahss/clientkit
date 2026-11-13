import type { ReactNode } from "react";

import type { Locale } from "@/i18n/config";

/** 日本語・英語の文言から現在の言語のものを選ぶ関数 */
export type T = (ja: string, en: string) => string;
export type Pair = [string, string];
export type Values = Record<string, string | boolean | number>;

export type Table = { title?: string; head: string[]; rows: (string | number)[][] };
export type Result = {
  error?: string;
  notes?: string[];
  text?: string;
  tables?: Table[];
  preview?: ReactNode;
  downloads?: { name: string; data: Uint8Array | string; mime: string }[];
};

export type OptionDef =
  | { id: string; kind: "select"; label: Pair; default: string; choices: { value: string; label: string | Pair }[]; hidden?: (v: Values) => boolean }
  | { id: string; kind: "checkbox"; label: Pair; default: boolean; hidden?: (v: Values) => boolean }
  | { id: string; kind: "number"; label: Pair; default: number; min?: number; max?: number; hidden?: (v: Values) => boolean }
  | { id: string; kind: "text"; label: Pair; default: string; placeholder?: string; secret?: boolean; hidden?: (v: Values) => boolean };

export type RunContext = {
  inputs: Record<string, string>;
  opts: Values;
  files: { name: string; bytes: Uint8Array }[];
  t: T;
  lang: Locale;
};

export type ToolSpec = {
  inputs: { id: string; label: Pair; placeholder?: string; rows?: number; mono?: boolean }[];
  options?: OptionDef[];
  files?: { accept?: string; multiple?: boolean; label?: Pair };
  /** 「サンプルを入力」で最初の入力欄に入れる値（入力IDごと） */
  sample?: Record<string, string>;
  outputLabel?: Pair;
  /** 実行ボタンを押したときだけ計算する（ボタンの文言）。暗号処理など重い処理向け */
  manual?: Pair;
  /** 入力がなくても計算する */
  runWithoutInput?: boolean;
  safetyNote?: Pair;
  run: (ctx: RunContext) => Result | Promise<Result>;
};
