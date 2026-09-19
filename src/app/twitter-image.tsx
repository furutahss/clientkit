import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

export const dynamic = "force-static";
export const alt = siteConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "linear-gradient(135deg, #0a0a0a 0%, #262626 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700 }}>{siteConfig.name}</div>
        <div style={{ fontSize: 36, color: "#a3a3a3" }}>
          {siteConfig.tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
