import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { releaseNotes, type ReleaseNoteType } from "@/config/release-notes";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n/dictionaries";
import { locales, type Locale } from "@/i18n/config";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(
  props: PageProps<"/[lang]/release-notes">
): Promise<Metadata> {
  const { lang } = (await props.params) as { lang: Locale };
  const dict = getDictionary(lang);

  return {
    title: dict.releaseNotes.pageTitle,
    description: dict.releaseNotes.pageDescription,
    openGraph: {
      title: dict.releaseNotes.pageTitle,
      description: dict.releaseNotes.pageDescription,
    },
  };
}

const badgeVariantByType: Record<
  ReleaseNoteType,
  "default" | "secondary" | "outline"
> = {
  feature: "default",
  improvement: "secondary",
  fix: "outline",
  chore: "outline",
};

function formatDate(dateIso: string, lang: Locale) {
  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

export default async function ReleaseNotesPage(
  props: PageProps<"/[lang]/release-notes">
) {
  const { lang } = (await props.params) as { lang: Locale };
  const dict = getDictionary(lang);

  const typeLabels: Record<ReleaseNoteType, string> = {
    feature: dict.releaseNotes.typeFeature,
    improvement: dict.releaseNotes.typeImprovement,
    fix: dict.releaseNotes.typeFix,
    chore: dict.releaseNotes.typeChore,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Breadcrumb
          lang={lang}
          items={[{ label: dict.releaseNotes.breadcrumbLabel }]}
        />
        <h1 className="text-2xl font-bold tracking-tight">
          {dict.releaseNotes.pageTitle}
        </h1>
        <p className="text-muted-foreground">
          {dict.releaseNotes.pageDescription}
        </p>
      </div>

      <ol className="flex flex-col gap-8">
        {releaseNotes.map((group) => (
          <li key={group.date} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              <time dateTime={group.date}>{formatDate(group.date, lang)}</time>
            </h2>
            <ul className="flex flex-col gap-2 border-l pl-4">
              {group.entries.map((entry, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={badgeVariantByType[entry.type]}
                    className="mt-0.5 shrink-0"
                  >
                    {typeLabels[entry.type]}
                  </Badge>
                  <span>{entry.title[lang]}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        {lang === "ja" ? (
          <>
            すべての更新履歴は
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mx-1 underline underline-offset-2 hover:text-foreground"
            >
              GitHubリポジトリ
            </a>
            でも確認できます。
          </>
        ) : (
          <>
            The full history is also available on the
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mx-1 underline underline-offset-2 hover:text-foreground"
            >
              GitHub repository
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}
