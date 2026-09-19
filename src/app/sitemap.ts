import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { tools } from "@/config/tools";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const toolEntries = tools.map((tool) => ({
    url: `${siteConfig.url}${tool.path}`,
  }));

  return [{ url: siteConfig.url }, ...toolEntries];
}
