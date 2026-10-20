import type { Metadata } from "next";
import { localizedAlternates } from "@/config/seo";
import { Suspense } from "react";
import { ToolExplorer } from "@/components/home/tool-explorer";
import { ToolDirectory } from "@/components/home/tool-directory";
import { ToolCategories } from "@/components/home/tool-categories";
import { tools } from "@/config/tools";
import { formatTemplate } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(props: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await props.params;
  return { alternates: localizedAlternates(lang as Locale) };
}

export default async function Home(props: PageProps<"/[lang]">) {
  const { lang } = (await props.params) as { lang: Locale };
  const dict = getDictionary(lang).discovery;

  return (
    <div className="flex flex-col gap-6 py-2 sm:py-4">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {dict.homeTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatTemplate(dict.homeDescription, { count: tools.length })}
        </p>
      </section>
      <Suspense fallback={<ToolCategories lang={lang} />}>
        <ToolExplorer />
      </Suspense>
      <ToolDirectory lang={lang} />
    </div>
  );
}
