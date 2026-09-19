import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getToolPath, tools } from "@/config/tools";
import { locales } from "@/i18n/config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.flatMap((lang) => [
    {
      url: `${siteConfig.url}/${lang}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 1.0,
    },
    ...tools.map((tool) => ({
      url: `${siteConfig.url}${getToolPath(lang, tool.id)}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]);
}
