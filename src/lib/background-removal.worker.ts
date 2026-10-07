/**
 * 背景除去の推論を行う Web Worker。
 * モデル（U²-Net の軽量版 u2netp、Apache-2.0）はこのサイトから取得し、初回のみ Cache API に保存する。
 * WebGPU と JSPI に対応したブラウザでは WebGPU、それ以外は WASM（CPU）で推論する。
 */
import { buildAlpha, MODEL_SIZE, normalizeMask, type MaskAdjustments } from "@/lib/background-removal";

export const MODEL_URL = "/models/u2netp.onnx";
/** モデルのバイト数（圧縮配信で Content-Length がない場合の進捗表示に使う） */
const MODEL_BYTES = 4_574_861;
const CACHE_NAME = "clientkit-models-v1";

export type Backend = "webgpu" | "wasm";
export type LoadProgress = { loaded: number; total: number | null; cached: boolean };

type OrtModule = typeof import("onnxruntime-web/wasm");
type Session = Awaited<ReturnType<OrtModule["InferenceSession"]["create"]>>;

let session: Session | null = null;
let ort: OrtModule | null = null;
let backend: Backend = "wasm";
let lastMask: Float32Array | null = null;

function post(message: unknown, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(message, transfer);
}

/** モデルを取得する（Cache API にあればそれを使い、なければダウンロードして保存する） */
async function fetchModel(report: (progress: LoadProgress) => void): Promise<Uint8Array> {
  const url = new URL(MODEL_URL, self.location.origin).href;
  const cache = typeof caches === "undefined" ? null : await caches.open(CACHE_NAME).catch(() => null);
  const cached = await cache?.match(url);
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    report({ loaded: bytes.length, total: bytes.length, cached: true });
    return bytes;
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error("download");
  // 圧縮して配信されると Content-Length は圧縮後のサイズになる（またはない）ため、既知のサイズを使う
  const total = MODEL_BYTES;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    report({ loaded, total, cached: false });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  await cache?.put(url, new Response(bytes, { headers: { "content-type": "application/octet-stream" } })).catch(() => undefined);
  return bytes;
}

async function createSession(model: Uint8Array): Promise<void> {
  const wasmPaths = new URL("/vendor/onnxruntime/", self.location.origin).href;
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  const canUseWebGpu = "Suspending" in WebAssembly && !!gpu && !!(await gpu.requestAdapter().catch(() => null));
  if (canUseWebGpu) {
    try {
      const jspi = (await import("onnxruntime-web/jspi")) as unknown as OrtModule;
      jspi.env.wasm.wasmPaths = wasmPaths;
      session = await jspi.InferenceSession.create(model, { executionProviders: ["webgpu"] });
      ort = jspi;
      backend = "webgpu";
      return;
    } catch {
      // WebGPU で初期化できない場合は CPU 版にフォールバックする
    }
  }
  const wasm = await import("onnxruntime-web/wasm");
  wasm.env.wasm.wasmPaths = wasmPaths;
  session = await wasm.InferenceSession.create(model, { executionProviders: ["wasm"] });
  ort = wasm;
  backend = "wasm";
}

type Request =
  | { id: number; type: "load" }
  | { id: number; type: "infer"; input: Float32Array }
  | { id: number; type: "alpha"; width: number; height: number; adjust: MaskAdjustments };

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.type === "load") {
      if (!session) {
        const model = await fetchModel((progress) => post({ id: request.id, progress }));
        await createSession(model);
      }
      post({ id: request.id, ok: true, result: backend });
    } else if (request.type === "infer") {
      if (!session || !ort) throw new Error("not loaded");
      const tensor = new ort.Tensor("float32", request.input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
      const outputs = await session.run({ [session.inputNames[0]]: tensor });
      const output = outputs[session.outputNames[0]];
      lastMask = normalizeMask(new Float32Array(output.data as Float32Array));
      tensor.dispose();
      for (const value of Object.values(outputs)) value.dispose();
      post({ id: request.id, ok: true, result: true });
    } else {
      if (!lastMask) throw new Error("no mask");
      const alpha = buildAlpha(lastMask, MODEL_SIZE, request.width, request.height, request.adjust);
      post({ id: request.id, ok: true, result: alpha }, [alpha.buffer]);
    }
  } catch (error) {
    post({ id: request.id, ok: false, error: request.type === "load" ? "load" : String(error instanceof Error ? error.message : error) });
  }
};
