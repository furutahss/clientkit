import type { Metadata } from "next";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  privacyPolicyEstablishedAt,
  privacyPolicySections,
  privacyPolicyUpdatedAt,
} from "@/config/privacy-policy";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n/dictionaries";
import { locales, type Locale } from "@/i18n/config";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(
  props: PageProps<"/[lang]/privacy-policy">
): Promise<Metadata> {
  const { lang } = (await props.params) as { lang: Locale };
  const dict = getDictionary(lang);

  return {
    title: dict.privacyPolicy.pageTitle,
    description: dict.privacyPolicy.pageDescription,
    openGraph: {
      title: dict.privacyPolicy.pageTitle,
      description: dict.privacyPolicy.pageDescription,
    },
    alternates: {
      canonical: `/${lang}/privacy-policy`,
      languages: {
        ja: "/ja/privacy-policy",
        en: "/en/privacy-policy",
      },
    },
  };
}

function formatDate(dateIso: string, lang: Locale) {
  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

const linkClassName =
  "underline underline-offset-2 hover:text-foreground break-words";

export default async function PrivacyPolicyPage(
  props: PageProps<"/[lang]/privacy-policy">
) {
  const { lang } = (await props.params) as { lang: Locale };
  const dict = getDictionary(lang);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Breadcrumb
          lang={lang}
          items={[{ label: dict.privacyPolicy.breadcrumbLabel }]}
        />
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.privacyPolicy.pageTitle}
        </h1>
        <p className="text-muted-foreground">
          {dict.privacyPolicy.pageDescription}
        </p>
      </div>

      <div className="flex max-w-3xl flex-col gap-8">
        {privacyPolicySections.map((section, index) => (
          <section key={index} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {index + 1}. {section.heading[lang]}
            </h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="text-sm leading-relaxed">
                {paragraph[lang]}
              </p>
            ))}
            {section.links && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={linkClassName}
                    >
                      {link.label[lang]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="text-sm">
          <a
            href={`${siteConfig.githubUrl}/issues`}
            target="_blank"
            rel="noreferrer noopener"
            className={linkClassName}
          >
            {dict.privacyPolicy.contactLink}
          </a>
        </p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <dt>{dict.privacyPolicy.establishedLabel}</dt>
          <dd>
            <time dateTime={privacyPolicyEstablishedAt}>
              {formatDate(privacyPolicyEstablishedAt, lang)}
            </time>
          </dd>
          <dt>{dict.privacyPolicy.updatedLabel}</dt>
          <dd>
            <time dateTime={privacyPolicyUpdatedAt}>
              {formatDate(privacyPolicyUpdatedAt, lang)}
            </time>
          </dd>
        </dl>
      </div>
    </div>
  );
}
