import { Lock, ShieldCheck, Zap } from "lucide-react";

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

  const features = [
    { icon: ShieldCheck, ...dict.home.features.secure },
    { icon: Zap, ...dict.home.features.fast },
    { icon: Lock, ...dict.home.features.privacy },
  ];

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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-2 rounded-xl border p-6 text-center"
            >
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{dict.home.toolsHeading}</h2>
        <ToolExplorer />
      </section>
    </div>
  );
}
