/**
 * 動画の解析・GIF変換・圧縮を行う Web Worker。
 * デコード・エンコードはブラウザの WebCodecs を mediabunny（MPL-2.0）経由で使い、GIF は gifenc（MIT）で書き出す。
 */
import { GIFEncoder, quantize } from "gifenc";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  canEncodeAudio,
  canEncodeVideo,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  WebMOutputFormat,
} from "mediabunny";

import {
  ditherToPalette,
  fitDimensions,
  frameTimestamps,
  gifFrameDelay,
  limitHeight,
  targetVideoBitrate,
  type DitherMode,
  type Palette,
  type PaletteMode,
} from "@/lib/video-convert";

export type VideoInfo = {
  duration: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  canDecode: boolean;
};

export type GifRequest = {
  type: "gif";
  file: File;
  start: number;
  end: number;
  fps: number;
  width: number;
  loop: number;
  palette: PaletteMode;
  dither: DitherMode;
};

export type CompressRequest = {
  type: "compress";
  file: File;
  format: "mp4" | "webm";
  quality: "low" | "medium" | "high" | "veryHigh";
  /** 目標ファイルサイズ（バイト）。指定した場合は quality より優先する */
  targetBytes: number | null;
  maxHeight: number | null;
  fps: number | null;
  audio: "keep" | "remove";
  audioBitrate: number;
  start: number;
  end: number;
};

export type VideoProgress = { progress: number; stage: "decode" | "encode" };

/** 失敗の種類（画面のメッセージに対応） */
export type VideoErrorCode = "unsupportedFormat" | "noVideo" | "cannotDecode" | "cannotEncode" | "failed";

class VideoError extends Error {
  constructor(readonly code: VideoErrorCode) {
    super(code);
  }
}

const QUALITIES = { low: QUALITY_LOW, medium: QUALITY_MEDIUM, high: QUALITY_HIGH, veryHigh: QUALITY_VERY_HIGH };

function post(message: unknown, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(message, transfer);
}

function openInput(file: File) {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

async function getVideoTrack(input: Input) {
  let track;
  try {
    track = await input.getPrimaryVideoTrack();
  } catch {
    throw new VideoError("unsupportedFormat");
  }
  if (!track) throw new VideoError("noVideo");
  return track;
}

async function probe(file: File): Promise<VideoInfo> {
  const input = openInput(file);
  try {
    const track = await getVideoTrack(input);
    const audio = await input.getPrimaryAudioTrack().catch(() => null);
    return {
      duration: await input.computeDuration(),
      width: track.displayWidth,
      height: track.displayHeight,
      videoCodec: track.codec,
      audioCodec: audio?.codec ?? null,
      canDecode: await track.canDecode(),
    };
  } finally {
    input.dispose();
  }
}

async function makeGif(request: GifRequest, report: (progress: VideoProgress) => void): Promise<Uint8Array> {
  const input = openInput(request.file);
  try {
    const track = await getVideoTrack(input);
    if (!(await track.canDecode())) throw new VideoError("cannotDecode");
    const { width, height } = fitDimensions(track.displayWidth, track.displayHeight, request.width);
    const sink = new CanvasSink(track, { width, height, fit: "fill", poolSize: 2 });
    const timestamps = frameTimestamps(request.start, request.end, request.fps);
    const readPixels = (canvas: OffscreenCanvas | HTMLCanvasElement) =>
      (canvas.getContext("2d") as OffscreenCanvasRenderingContext2D).getImageData(0, 0, width, height).data;

    // 全体で共通のパレット（palettegen 相当）は、一部のフレームから色を集めて作る
    let globalPalette: Palette | null = null;
    if (request.palette === "global") {
      const sampleCount = Math.min(16, timestamps.length);
      const samples = Array.from({ length: sampleCount }, (_, i) => timestamps[Math.floor((i * timestamps.length) / sampleCount)]);
      const merged = new Uint8ClampedArray(width * height * 4 * sampleCount);
      let offset = 0;
      for await (const wrapped of sink.canvasesAtTimestamps(samples)) {
        if (!wrapped) continue;
        merged.set(readPixels(wrapped.canvas), offset);
        offset += width * height * 4;
      }
      globalPalette = quantize(merged.subarray(0, offset), 256);
    }

    const encoder = GIFEncoder();
    const delay = gifFrameDelay(request.fps);
    let index = 0;
    type GifFrame = { indexes: Uint8Array; palette: Palette };
    let previous: GifFrame | null = null;
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      // 映像が音声より先に終わっている場合など、フレームがない時刻は直前のフレームを繰り返して長さを保つ
      let frame: GifFrame | null = previous;
      if (wrapped) {
        const pixels = readPixels(wrapped.canvas);
        const palette = globalPalette ?? quantize(pixels, 256);
        frame = { indexes: ditherToPalette(pixels, width, height, palette, request.dither), palette };
      }
      if (frame) {
        // 共通パレットの場合は最初のフレームだけにパレットを書く（以降は全体のパレットを使う）
        encoder.writeFrame(frame.indexes, width, height, {
          palette: globalPalette && previous ? undefined : frame.palette,
          delay,
          repeat: request.loop,
        });
        previous = frame;
      }
      index += 1;
      report({ progress: index / timestamps.length, stage: "encode" });
    }
    encoder.finish();
    return encoder.bytes();
  } finally {
    input.dispose();
  }
}

async function compress(request: CompressRequest, report: (progress: VideoProgress) => void): Promise<Uint8Array> {
  const input = openInput(request.file);
  try {
    const track = await getVideoTrack(input);
    if (!(await track.canDecode())) throw new VideoError("cannotDecode");
    const videoCodec = request.format === "mp4" ? "avc" : "vp9";
    const audioCodec = request.format === "mp4" ? "aac" : "opus";
    const { width, height } = limitHeight(track.displayWidth, track.displayHeight, request.maxHeight);
    const duration = request.end - request.start;
    const audioBitrate = request.audio === "remove" ? 0 : request.audioBitrate;
    const bitrate = request.targetBytes ? targetVideoBitrate(request.targetBytes, duration, audioBitrate) : QUALITIES[request.quality];
    if (!(await canEncodeVideo(videoCodec, { width, height }))) throw new VideoError("cannotEncode");
    const keepAudio = request.audio === "keep" && (await canEncodeAudio(audioCodec));

    const target = new BufferTarget();
    const output = new Output({ format: request.format === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target });
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: request.start, end: request.end },
      video: {
        codec: videoCodec,
        width,
        height,
        fit: "contain",
        bitrate,
        frameRate: request.fps ?? undefined,
        forceTranscode: true,
      },
      audio: keepAudio ? { codec: audioCodec, bitrate: audioBitrate, forceTranscode: true } : { discard: true },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new VideoError("cannotEncode");
    conversion.onProgress = (progress) => report({ progress, stage: "encode" });
    await conversion.execute();
    if (!target.buffer) throw new VideoError("failed");
    return new Uint8Array(target.buffer);
  } finally {
    input.dispose();
  }
}

self.onmessage = async (event: MessageEvent<{ id: number; type: "probe"; file: File } | ({ id: number } & (GifRequest | CompressRequest))>) => {
  const request = event.data;
  const report = (progress: VideoProgress) => post({ id: request.id, progress });
  try {
    if (request.type === "probe") {
      post({ id: request.id, ok: true, result: await probe(request.file) });
      return;
    }
    const bytes = request.type === "gif" ? await makeGif(request, report) : await compress(request, report);
    post({ id: request.id, ok: true, result: bytes }, [bytes.buffer]);
  } catch (error) {
    post({ id: request.id, ok: false, error: error instanceof VideoError ? error.code : "failed" });
  }
};
