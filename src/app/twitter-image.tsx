import { ImageResponse } from "next/og";

import { OgImageContent } from "@/lib/og-render";
import { siteConfig } from "@/config/site";

export const dynamic = "force-static";
export const alt = siteConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgImageContent />, { ...size });
}
