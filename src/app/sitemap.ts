import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { getToolPath, tools } from '@/config/tools';
import { trustPages } from '@/config/trust-pages';
import { locales } from '@/i18n/config';
import { localizedAlternates } from '@/config/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap(lang => {
    const paths = ['', '/release-notes', '/privacy-policy', ...Object.keys(trustPages).map(id => `/${id}`), ...tools.map(tool => getToolPath(lang, tool.id).slice(3))];
    return paths.map(suffix => ({
      url: `${siteConfig.url}/${lang}${suffix}`,
      alternates: { languages: localizedAlternates(lang, suffix).languages },
    }));
  });
}
