import { BrandMark } from "@/lib/brand-mark";
import { Glyph, iconPaths } from "@/lib/brand-icons";
import { siteConfig } from "@/config/site";

const badgeIcons = [
  iconPaths.binary,
  iconPaths.hash,
  iconPaths.database,
  iconPaths.regex,
  iconPaths.imageDown,
  iconPaths.keyRound,
  iconPaths.link2,
];

// 右側の余白に散りばめる装飾アイコンの座標（左側のテキスト領域とは重ならないように配置）
const scatter: { x: number; y: number; size: number; opacity: number }[] = [
  { x: 700, y: 46, size: 46, opacity: 0.16 },
  { x: 860, y: 30, size: 32, opacity: 0.11 },
  { x: 1010, y: 78, size: 52, opacity: 0.15 },
  { x: 1128, y: 44, size: 30, opacity: 0.1 },
  { x: 764, y: 186, size: 36, opacity: 0.12 },
  { x: 954, y: 216, size: 60, opacity: 0.16 },
  { x: 1108, y: 196, size: 34, opacity: 0.1 },
  { x: 820, y: 336, size: 44, opacity: 0.14 },
  { x: 1004, y: 398, size: 36, opacity: 0.12 },
  { x: 1132, y: 372, size: 48, opacity: 0.15 },
  { x: 760, y: 480, size: 34, opacity: 0.1 },
  { x: 928, y: 536, size: 50, opacity: 0.14 },
  { x: 1084, y: 512, size: 30, opacity: 0.1 },
];

/**
 * OGP/Twitterカード共通のビジュアル。
 * ロケールに依存する文言は使わず、ブランドマークとツールアイコンのみで
 * 「ブラウザ完結のツールキット」であることを表現する。
 */
export function OgImageContent() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 55%, #262626 100%)",
        fontFamily: "sans-serif",
      }}
    >
      {scatter.map((point, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            position: "absolute",
            left: point.x,
            top: point.y,
            opacity: point.opacity,
          }}
        >
          <Glyph
            nodes={badgeIcons[i % badgeIcons.length]}
            size={point.size}
            color="#fafafa"
            strokeWidth={1.5}
          />
        </div>
      ))}

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 30,
          height: "100%",
          padding: "0 96px",
        }}
      >
        <BrandMark size={136} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: -2,
            }}
          >
            {siteConfig.name}
          </div>
          <div style={{ fontSize: 28, color: "#8f8f8f", letterSpacing: 1 }}>
            {siteConfig.domain}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          {badgeIcons.slice(0, 5).map((nodes, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 46,
                height: 46,
                borderRadius: 12,
                background: "rgba(255,255,255,0.07)",
              }}
            >
              <Glyph nodes={nodes} size={23} color="#cfcfcf" strokeWidth={1.8} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
