import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getToolPath, tools } from "@/config/tools";
import { locales } from "@/i18n/config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((lang) => [
    { url: `${siteConfig.url}/${lang}` },
    ...tools.map((tool) => ({
      url: `${siteConfig.url}${getToolPath(lang, tool.id)}`,
    })),
  ]);
}
