import type { Locale } from "@/i18n/config";

export const siteConfig = {
  name: "ClientKit",
  domain: "clientkit.dev",
  url: "https://clientkit.dev",
  githubUrl: "https://github.com/furutahss/clientkit",
};

const localizedSiteText: Record<Locale, { tagline: string; description: string }> = {
  ja: {
    tagline: "ブラウザ完結で安全・高速",
    description:
      "入力テキストやファイルを処理サーバーへ送らず、ブラウザ上で変換・解析できるWebツール集。",
  },
  en: {
    tagline: "Secure and fast, fully in your browser",
    description:
      "Web tools that transform and analyze text and files in your browser without uploading tool inputs to a processing server.",
  },
};

export function getSiteText(locale: Locale) {
  return localizedSiteText[locale];
}
