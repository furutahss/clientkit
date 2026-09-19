import type { Metadata } from "next";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SyncHtmlLang } from "@/components/sync-html-lang";
import { siteConfig, getSiteText } from "@/config/site";
import { locales, type Locale } from "@/i18n/config";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(
  props: LayoutProps<"/[lang]">
): Promise<Metadata> {
  const { lang } = (await props.params) as { lang: Locale };
  const siteText = getSiteText(lang);
  const title = `${siteConfig.name} - ${siteText.tagline}`;

  return {
    title: {
      default: title,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteText.description,
    openGraph: {
      type: "website",
      locale: lang === "ja" ? "ja_JP" : "en_US",
      url: `${siteConfig.url}/${lang}`,
      siteName: siteConfig.name,
      title,
      description: siteText.description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: siteText.description,
    },
    alternates: {
      languages: {
        ja: "/ja",
        en: "/en",
      },
    },
  };
}

export default async function LocaleLayout(props: LayoutProps<"/[lang]">) {
  const { lang } = (await props.params) as { lang: Locale };

  return (
    <>
      <SyncHtmlLang lang={lang} />
      <Header lang={lang} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
            {props.children}
          </div>
        </main>
      </div>
    </>
  );
}
