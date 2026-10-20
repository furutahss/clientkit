import { siteConfig } from './site';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

export function localizedAlternates(lang: Locale, suffix = '') {
  const url = (locale: Locale) => `${siteConfig.url}/${locale}${suffix}`;
  return {
    canonical: url(lang),
    languages: {
      ...Object.fromEntries(locales.map(locale => [locale, url(locale)])),
      'x-default': url(defaultLocale),
    },
  };
}
