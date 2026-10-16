// gifenc は型定義を同梱していないため、このプロジェクトで使う部分だけを定義する
declare module "gifenc" {
  export type GifPalette = number[][];
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: "rgb565" | "rgb444" | "rgba4444" }): GifPalette;
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: GifPalette; delay?: number; repeat?: number; transparent?: boolean; dispose?: number }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
