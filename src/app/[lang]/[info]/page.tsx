import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { trustPages } from '@/config/trust-pages';
import { localizedAlternates } from "@/config/seo";
import { siteConfig } from '@/config/site';
import { locales, type Locale } from '@/i18n/config';

export function generateStaticParams() {
  return locales.flatMap(lang => Object.keys(trustPages).map(info => ({ lang, info })));
}

export async function generateMetadata(props: PageProps<'/[lang]/[info]'>): Promise<Metadata> {
  const { lang, info } = await props.params;
  const page = trustPages[info];
  if (!page || !locales.includes(lang as Locale)) return {};
  return { title: page.title[lang as Locale], description: page.description[lang as Locale], alternates: localizedAlternates(lang as Locale, `/${info}`) };
}

export default async function InfoPage(props: PageProps<'/[lang]/[info]'>) {
  const { lang: language, info } = await props.params;
  const lang = language as Locale;
  const page = trustPages[info];
  if (!page || !locales.includes(lang)) notFound();
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <Breadcrumb lang={lang} items={[{ label: page.title[lang] }]} />
      <h1 className="text-2xl font-bold">{page.title[lang]}</h1>
      <p className="text-muted-foreground">{page.description[lang]}</p>
      {page.sections.map(section => (
        <section key={section.heading.en} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{section.heading[lang]}</h2>
          {section.paragraphs.map((p, i) => <p key={i} className="text-sm leading-relaxed">{p[lang]}</p>)}
        </section>
      ))}
      <p className="text-sm"><a href={`${siteConfig.githubUrl}/issues`} target="_blank" rel="noreferrer noopener" className="underline">GitHub Issues</a></p>
      <nav aria-label={lang === 'ja' ? 'サイト情報' : 'Site information'} className="flex flex-wrap gap-4 text-sm underline">
        {Object.entries(trustPages).filter(([id]) => id !== info).map(([id, p]) => <Link key={id} href={`/${lang}/${id}`}>{p.title[lang]}</Link>)}
        <Link href={`/${lang}/privacy-policy`}>{lang === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}</Link>
      </nav>
    </article>
  );
}
