import { ToolExplorer } from "@/components/home/tool-explorer";
import { siteConfig, getSiteText } from "@/config/site";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function Home(props: PageProps<"/[lang]">) {
  const { lang } = (await props.params) as { lang: Locale };
  const dict = getDictionary(lang);
  const siteText = getSiteText(lang);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 py-6 text-center sm:py-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <p className="mx-auto max-w-2xl text-lg font-medium text-primary">
          {siteText.tagline}
        </p>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {siteText.description}
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{dict.home.toolsHeading}</h2>
        <ToolExplorer />
      </section>
    </div>
  );
}
