import ja from "@/dictionaries/ja.json";
import en from "@/dictionaries/en.json";
import type { Locale } from "@/i18n/config";

const dictionaries = { ja, en } as const;

export type Dictionary = typeof ja;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
