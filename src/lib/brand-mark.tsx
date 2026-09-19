import { Glyph, iconPaths } from "@/lib/brand-icons";

/**
 * favicon / OGP画像で共有するブランドマーク（シールドマーク）。
 * ヘッダーのロゴ（ShieldCheck）を、テキストに依存しないアイコンとして再構成したもの。
 */
export function BrandMark({ size = 128 }: { size?: number }) {
  const iconSize = Math.round(size * 0.68);
  // 小さいサイズ（favicon）ほど線を太くして視認性を確保する
  const strokeWidth = size <= 48 ? 2.4 : 1.75;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        background: "linear-gradient(135deg, #262626 0%, #050505 100%)",
      }}
    >
      <Glyph
        nodes={iconPaths.shieldCheck}
        size={iconSize}
        color="#fafafa"
        strokeWidth={strokeWidth}
      />
    </div>
  );
}
