import type { Locale } from "@/i18n/config";

export const siteConfig = {
  name: "ClientKit",
  domain: "clientkit.dev",
  url: "https://clientkit.dev",
  githubUrl: "https://github.com/",
};

const localizedSiteText: Record<Locale, { tagline: string; description: string }> = {
  ja: {
    tagline: "ブラウザ完結で安全・高速",
    description:
      "サーバーにデータを送信せず、すべての処理をブラウザ上で完結させる安全なWebツール集。",
  },
  en: {
    tagline: "Secure and fast, fully in your browser",
    description:
      "A collection of safe web tools that run entirely in your browser — no data is ever sent to a server.",
  },
};

export function getSiteText(locale: Locale) {
  return localizedSiteText[locale];
}
