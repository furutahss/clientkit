/**
 * 外部CDNに依存せずセルフホストするためのファイル（WASM・学習データなど）を
 * node_modules から public/vendor にコピーする。dev・build の前に自動で実行される。
 * Cloudflare の静的アセットは1ファイル25MiBまでのため、それを超えるファイルは置かない。
 */
import { copyFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(root, "node_modules");
const vendor = join(root, "public", "vendor");
const MAX_BYTES = 25 * 1024 * 1024;

/** [コピー元（node_modules からの相対パス）, コピー先（public/vendor からの相対パス）] */
const files = [
  // OCR（tesseract.js）: Worker、LSTM専用のWASMコア（SIMD対応状況に応じて1つだけ読み込まれる）、学習データ
  ["tesseract.js/dist/worker.min.js", "tesseract/worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract/core/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract/core/tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz", "tesseract/lang/jpn.traineddata.gz"],
  ["@tesseract.js-data/jpn_vert/4.0.0_best_int/jpn_vert.traineddata.gz", "tesseract/lang/jpn_vert.traineddata.gz"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "tesseract/lang/eng.traineddata.gz"],
  // 請求書・見積書作成: PDFに埋め込む日本語フォント（SIL Open Font License 1.1。ライセンス文も同梱する）
  ["@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf", "fonts/NotoSansJP-Regular.ttf"],
  ["@expo-google-fonts/noto-sans-jp/LICENSE_FONT", "fonts/OFL.txt"],
  // 画像の背景除去: onnxruntime-web の WASM（CPU 版と、WebGPU を使う JSPI 版。WebGPU の jsep 版は25MiBを超えるため使わない）
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.mjs", "onnxruntime/ort-wasm-simd-threaded.mjs"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "onnxruntime/ort-wasm-simd-threaded.wasm"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.jspi.mjs", "onnxruntime/ort-wasm-simd-threaded.jspi.mjs"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.jspi.wasm", "onnxruntime/ort-wasm-simd-threaded.jspi.wasm"],
];

rmSync(vendor, { recursive: true, force: true });
for (const [from, to] of files) {
  const source = join(modules, from);
  const size = statSync(source).size;
  if (size > MAX_BYTES) throw new Error(`${from} is larger than 25 MiB (${size} bytes)`);
  const target = join(vendor, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
console.log(`Copied ${files.length} vendor assets to public/vendor`);
