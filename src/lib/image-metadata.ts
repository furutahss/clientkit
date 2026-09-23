/**
 * JPEG / PNG / WebP に含まれるメタデータ（EXIF・GPS・XMP・IPTCなど）を
 * 読み取り、画像データを再エンコードせずに取り除くためのユーティリティ。
 */

export type ImageFormat = "jpeg" | "png" | "webp";

export type MetadataGroup = "image" | "exif" | "gps" | "interop" | "thumbnail";

export type MetadataEntry = {
  group: MetadataGroup;
  tag: string;
  value: string;
};

export type GpsPosition = {
  latitude: number;
  longitude: number;
  altitude?: number;
};

export type MetadataReport = {
  format: ImageFormat;
  entries: MetadataEntry[];
  gps: GpsPosition | null;
  /** EXIF の Orientation（1〜8）。未設定の場合は null */
  orientation: number | null;
  hasExif: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  hasComment: boolean;
  /** PNG の tEXt / iTXt などのテキストチャンク */
  hasTextChunks: boolean;
};

export class UnsupportedImageError extends Error {}

const TAG_NAMES: Record<MetadataGroup, Record<number, string>> = {
  image: {
    0x010e: "ImageDescription",
    0x010f: "Make",
    0x0110: "Model",
    0x0112: "Orientation",
    0x011a: "XResolution",
    0x011b: "YResolution",
    0x0128: "ResolutionUnit",
    0x0131: "Software",
    0x0132: "DateTime",
    0x013b: "Artist",
    0x013e: "WhitePoint",
    0x0213: "YCbCrPositioning",
    0x8298: "Copyright",
    0x9c9b: "XPTitle",
    0x9c9c: "XPComment",
    0x9c9d: "XPAuthor",
    0x9c9e: "XPKeywords",
    0x9c9f: "XPSubject",
  },
  exif: {
    0x829a: "ExposureTime",
    0x829d: "FNumber",
    0x8822: "ExposureProgram",
    0x8827: "ISOSpeedRatings",
    0x8830: "SensitivityType",
    0x9000: "ExifVersion",
    0x9003: "DateTimeOriginal",
    0x9004: "DateTimeDigitized",
    0x9010: "OffsetTime",
    0x9011: "OffsetTimeOriginal",
    0x9012: "OffsetTimeDigitized",
    0x9101: "ComponentsConfiguration",
    0x9201: "ShutterSpeedValue",
    0x9202: "ApertureValue",
    0x9203: "BrightnessValue",
    0x9204: "ExposureBiasValue",
    0x9205: "MaxApertureValue",
    0x9206: "SubjectDistance",
    0x9207: "MeteringMode",
    0x9208: "LightSource",
    0x9209: "Flash",
    0x920a: "FocalLength",
    0x9214: "SubjectArea",
    0x927c: "MakerNote",
    0x9286: "UserComment",
    0x9290: "SubSecTime",
    0x9291: "SubSecTimeOriginal",
    0x9292: "SubSecTimeDigitized",
    0xa000: "FlashpixVersion",
    0xa001: "ColorSpace",
    0xa002: "PixelXDimension",
    0xa003: "PixelYDimension",
    0xa217: "SensingMethod",
    0xa300: "FileSource",
    0xa301: "SceneType",
    0xa401: "CustomRendered",
    0xa402: "ExposureMode",
    0xa403: "WhiteBalance",
    0xa404: "DigitalZoomRatio",
    0xa405: "FocalLengthIn35mmFilm",
    0xa406: "SceneCaptureType",
    0xa408: "Contrast",
    0xa409: "Saturation",
    0xa40a: "Sharpness",
    0xa420: "ImageUniqueID",
    0xa430: "CameraOwnerName",
    0xa431: "BodySerialNumber",
    0xa432: "LensSpecification",
    0xa433: "LensMake",
    0xa434: "LensModel",
    0xa435: "LensSerialNumber",
  },
  gps: {
    0x0000: "GPSVersionID",
    0x0001: "GPSLatitudeRef",
    0x0002: "GPSLatitude",
    0x0003: "GPSLongitudeRef",
    0x0004: "GPSLongitude",
    0x0005: "GPSAltitudeRef",
    0x0006: "GPSAltitude",
    0x0007: "GPSTimeStamp",
    0x0008: "GPSSatellites",
    0x0009: "GPSStatus",
    0x000a: "GPSMeasureMode",
    0x000b: "GPSDOP",
    0x000c: "GPSSpeedRef",
    0x000d: "GPSSpeed",
    0x000e: "GPSTrackRef",
    0x000f: "GPSTrack",
    0x0010: "GPSImgDirectionRef",
    0x0011: "GPSImgDirection",
    0x0012: "GPSMapDatum",
    0x0017: "GPSDestBearingRef",
    0x0018: "GPSDestBearing",
    0x001b: "GPSProcessingMethod",
    0x001d: "GPSDateStamp",
    0x001f: "GPSHPositioningError",
  },
  interop: {
    0x0001: "InteropIndex",
    0x0002: "InteropVersion",
  },
  thumbnail: {
    0x0103: "Compression",
    0x0201: "ThumbnailOffset",
    0x0202: "ThumbnailLength",
  },
};

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

/** 1つのタグで表示する値の最大要素数（MakerNoteなど巨大なバイナリ対策） */
const MAX_DISPLAY_VALUES = 16;

type RawValue = string | number[] | Uint8Array;

type ParsedIfd = Map<number, RawValue>;

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    if (bytes[i] === 0) break;
    text += String.fromCharCode(bytes[i]);
  }
  return text.trim();
}

class TiffReader {
  private view: DataView;
  private little: boolean;

  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const order = readAscii(bytes, 0, 2);
    if (order !== "II" && order !== "MM") throw new Error("invalid tiff header");
    this.little = order === "II";
  }

  get firstIfdOffset(): number {
    return this.u32(4);
  }

  u16(offset: number): number {
    return this.view.getUint16(offset, this.little);
  }

  u32(offset: number): number {
    return this.view.getUint32(offset, this.little);
  }

  /** IFDを読み取り、タグIDと値の対応表と次のIFDへのオフセットを返す */
  readIfd(offset: number): { tags: ParsedIfd; next: number } {
    const tags: ParsedIfd = new Map();
    if (offset <= 0 || offset + 2 > this.bytes.length) return { tags, next: 0 };

    const count = this.u16(offset);
    for (let i = 0; i < count; i += 1) {
      const entry = offset + 2 + i * 12;
      if (entry + 12 > this.bytes.length) break;
      const tag = this.u16(entry);
      const type = this.u16(entry + 2);
      const n = this.u32(entry + 4);
      const size = TYPE_SIZES[type];
      if (!size) continue;
      const total = size * n;
      const valueOffset = total <= 4 ? entry + 8 : this.u32(entry + 8);
      if (valueOffset + total > this.bytes.length) continue;
      tags.set(tag, this.readValue(type, n, valueOffset));
    }
    const nextPos = offset + 2 + count * 12;
    const next = nextPos + 4 <= this.bytes.length ? this.u32(nextPos) : 0;
    return { tags, next };
  }

  private readValue(type: number, count: number, offset: number): RawValue {
    if (type === 2) return readAscii(this.bytes, offset, count);
    if (type === 7 || type === 1 || type === 6) {
      return this.bytes.subarray(offset, offset + count);
    }
    const values: number[] = [];
    const limit = Math.min(count, 64);
    for (let i = 0; i < limit; i += 1) {
      switch (type) {
        case 3:
          values.push(this.u16(offset + i * 2));
          break;
        case 8:
          values.push(this.view.getInt16(offset + i * 2, this.little));
          break;
        case 4:
          values.push(this.u32(offset + i * 4));
          break;
        case 9:
          values.push(this.view.getInt32(offset + i * 4, this.little));
          break;
        case 5: {
          const num = this.u32(offset + i * 8);
          const den = this.u32(offset + i * 8 + 4);
          values.push(den === 0 ? 0 : num / den);
          break;
        }
        case 10: {
          const num = this.view.getInt32(offset + i * 8, this.little);
          const den = this.view.getInt32(offset + i * 8 + 4, this.little);
          values.push(den === 0 ? 0 : num / den);
          break;
        }
        case 11:
          values.push(this.view.getFloat32(offset + i * 4, this.little));
          break;
        case 12:
          values.push(this.view.getFloat64(offset + i * 8, this.little));
          break;
      }
    }
    return values;
  }
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10000) / 10000);
}

function decodeUtf16Le(bytes: Uint8Array): string {
  return new TextDecoder("utf-16le").decode(bytes).replace(/\0+$/, "");
}

function formatValue(group: MetadataGroup, tag: string, value: RawValue): string {
  if (typeof value === "string") return value;

  if (value instanceof Uint8Array) {
    if (tag.startsWith("XP")) return decodeUtf16Le(value);
    if (tag === "UserComment" && value.length > 8) {
      const prefix = readAscii(value, 0, 8);
      const body = value.subarray(8);
      if (prefix.startsWith("UNICODE")) return decodeUtf16Le(body);
      return new TextDecoder().decode(body).replace(/\0+$/, "").trim();
    }
    if (tag === "ExifVersion" || tag === "FlashpixVersion" || tag === "InteropVersion") {
      return readAscii(value, 0, value.length);
    }
    if (tag === "GPSVersionID") return Array.from(value).join(".");
    if (value.length > MAX_DISPLAY_VALUES) return `(${value.length} bytes)`;
    return Array.from(value).join(" ");
  }

  if (tag === "ExposureTime" && value[0] > 0 && value[0] < 1) {
    return `1/${Math.round(1 / value[0])}`;
  }
  if (tag === "FNumber") return `f/${formatNumber(value[0])}`;
  if (tag === "FocalLength") return `${formatNumber(value[0])} mm`;
  if (group === "gps" && (tag === "GPSLatitude" || tag === "GPSLongitude")) {
    const [d = 0, m = 0, s = 0] = value;
    return `${formatNumber(d)}° ${formatNumber(m)}' ${formatNumber(s)}"`;
  }
  if (tag === "GPSTimeStamp") {
    return value.map((part) => String(Math.floor(part)).padStart(2, "0")).join(":");
  }
  if (tag === "GPSAltitude") return `${formatNumber(value[0])} m`;

  const shown = value.slice(0, MAX_DISPLAY_VALUES).map(formatNumber).join(", ");
  return value.length > MAX_DISPLAY_VALUES ? `${shown}, …` : shown;
}

function toDecimalDegrees(value: RawValue | undefined, ref: RawValue | undefined): number | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const [d = 0, m = 0, s = 0] = value;
  let decimal = d + m / 60 + s / 3600;
  if (typeof ref === "string" && (ref.startsWith("S") || ref.startsWith("W"))) {
    decimal = -decimal;
  }
  return Number.isFinite(decimal) ? decimal : null;
}

type ExifParseResult = {
  entries: MetadataEntry[];
  gps: GpsPosition | null;
  orientation: number | null;
};

/** TIFF形式のEXIFデータ（"Exif\0\0" 以降）を解析する */
export function parseExifTiff(tiff: Uint8Array): ExifParseResult {
  const result: ExifParseResult = { entries: [], gps: null, orientation: null };
  let reader: TiffReader;
  try {
    reader = new TiffReader(tiff);
  } catch {
    return result;
  }

  function collect(group: MetadataGroup, tags: ParsedIfd) {
    for (const [id, value] of tags) {
      if (id === 0x8769 || id === 0x8825 || id === 0xa005) continue;
      const name = TAG_NAMES[group][id] ?? `Tag 0x${id.toString(16).padStart(4, "0")}`;
      const text = formatValue(group, name, value);
      if (text === "") continue;
      result.entries.push({ group, tag: name, value: text });
    }
  }

  try {
    const ifd0 = reader.readIfd(reader.firstIfdOffset);
    collect("image", ifd0.tags);
    const orientation = ifd0.tags.get(0x0112);
    if (Array.isArray(orientation) && orientation[0] >= 1 && orientation[0] <= 8) {
      result.orientation = orientation[0];
    }

    const exifPointer = ifd0.tags.get(0x8769);
    let exifTags: ParsedIfd | null = null;
    if (Array.isArray(exifPointer)) {
      exifTags = reader.readIfd(exifPointer[0]).tags;
      collect("exif", exifTags);
      const interopPointer = exifTags.get(0xa005);
      if (Array.isArray(interopPointer)) {
        collect("interop", reader.readIfd(interopPointer[0]).tags);
      }
    }

    const gpsPointer = ifd0.tags.get(0x8825);
    if (Array.isArray(gpsPointer)) {
      const gpsTags = reader.readIfd(gpsPointer[0]).tags;
      collect("gps", gpsTags);
      const latitude = toDecimalDegrees(gpsTags.get(0x0002), gpsTags.get(0x0001));
      const longitude = toDecimalDegrees(gpsTags.get(0x0004), gpsTags.get(0x0003));
      if (latitude !== null && longitude !== null && (latitude !== 0 || longitude !== 0)) {
        const altitude = gpsTags.get(0x0006);
        const altitudeRef = gpsTags.get(0x0005);
        result.gps = {
          latitude,
          longitude,
          altitude: Array.isArray(altitude)
            ? altitude[0] *
              (altitudeRef instanceof Uint8Array && altitudeRef[0] === 1 ? -1 : 1)
            : undefined,
        };
      }
    }

    if (ifd0.next) {
      collect("thumbnail", reader.readIfd(ifd0.next).tags);
    }
  } catch {
    // 壊れたEXIFでも読めた範囲の情報を返す
  }

  return result;
}

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    readAscii(bytes, 1, 3) === "PNG"
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const XMP_HEADER = "http://ns.adobe.com/xap/1.0/";

function startsWithBytes(bytes: Uint8Array, offset: number, header: number[]): boolean {
  return header.every((value, index) => bytes[offset + index] === value);
}

type JpegSegment = { marker: number; start: number; end: number; dataStart: number };

/** JPEGのSOSより前のマーカーセグメントを列挙する */
function readJpegSegments(bytes: Uint8Array): { segments: JpegSegment[]; scanStart: number } {
  const segments: JpegSegment[] = [];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) throw new UnsupportedImageError("broken jpeg");
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return { segments, scanStart: offset };
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) throw new UnsupportedImageError("broken jpeg");
    segments.push({ marker, start: offset, end, dataStart: offset + 4 });
    offset = end;
  }
  throw new UnsupportedImageError("broken jpeg");
}

type PngChunk = { type: string; start: number; end: number; dataStart: number; length: number };

function readPngChunks(bytes: Uint8Array): PngChunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = readAscii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new UnsupportedImageError("broken png");
    chunks.push({ type, start: offset, end, dataStart: offset + 8, length });
    offset = end;
    if (type === "IEND") break;
  }
  return chunks;
}

type RiffChunk = { type: string; start: number; end: number; dataStart: number; length: number };

function readWebpChunks(bytes: Uint8Array): RiffChunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: RiffChunk[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = readAscii(bytes, offset, 4).padEnd(4, " ");
    const length = view.getUint32(offset + 4, true);
    const end = offset + 8 + length + (length % 2);
    if (offset + 8 + length > bytes.length) throw new UnsupportedImageError("broken webp");
    chunks.push({ type, start: offset, end: Math.min(end, bytes.length), dataStart: offset + 8, length });
    offset = end;
  }
  return chunks;
}

const PNG_TEXT_CHUNKS = new Set(["tEXt", "zTXt", "iTXt"]);
const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function emptyReport(format: ImageFormat): MetadataReport {
  return {
    format,
    entries: [],
    gps: null,
    orientation: null,
    hasExif: false,
    hasXmp: false,
    hasIptc: false,
    hasComment: false,
    hasTextChunks: false,
  };
}

function applyExif(report: MetadataReport, tiff: Uint8Array) {
  const parsed = parseExifTiff(tiff);
  report.hasExif = true;
  report.entries.push(...parsed.entries);
  report.gps ??= parsed.gps;
  report.orientation ??= parsed.orientation;
}

/** 画像に含まれるメタデータを読み取る */
export function readImageMetadata(bytes: Uint8Array): MetadataReport {
  const format = detectImageFormat(bytes);
  if (!format) throw new UnsupportedImageError("unsupported format");
  const report = emptyReport(format);

  if (format === "jpeg") {
    const { segments } = readJpegSegments(bytes);
    for (const segment of segments) {
      if (segment.marker === 0xe1) {
        if (startsWithBytes(bytes, segment.dataStart, EXIF_HEADER)) {
          applyExif(report, bytes.subarray(segment.dataStart + 6, segment.end));
        } else if (readAscii(bytes, segment.dataStart, XMP_HEADER.length) === XMP_HEADER) {
          report.hasXmp = true;
        }
      } else if (segment.marker === 0xed) {
        report.hasIptc = true;
      } else if (segment.marker === 0xfe) {
        report.hasComment = true;
      }
    }
  } else if (format === "png") {
    for (const chunk of readPngChunks(bytes)) {
      if (chunk.type === "eXIf") {
        applyExif(report, bytes.subarray(chunk.dataStart, chunk.dataStart + chunk.length));
      } else if (PNG_TEXT_CHUNKS.has(chunk.type)) {
        const keyword = readAscii(bytes, chunk.dataStart, Math.min(chunk.length, 79));
        if (keyword === "XML:com.adobe.xmp") report.hasXmp = true;
        else report.hasTextChunks = true;
      } else if (chunk.type === "tIME") {
        report.hasTextChunks = true;
      }
    }
  } else {
    for (const chunk of readWebpChunks(bytes)) {
      if (chunk.type === "EXIF") {
        let data = bytes.subarray(chunk.dataStart, chunk.dataStart + chunk.length);
        if (startsWithBytes(data, 0, EXIF_HEADER)) data = data.subarray(6);
        applyExif(report, data);
      } else if (chunk.type === "XMP ") {
        report.hasXmp = true;
      }
    }
  }

  return report;
}

export function hasAnyMetadata(report: MetadataReport): boolean {
  return (
    report.hasExif ||
    report.hasXmp ||
    report.hasIptc ||
    report.hasComment ||
    report.hasTextChunks
  );
}

/** Orientationタグだけを持つ最小限のEXIF（TIFF形式）を生成する */
function buildOrientationTiff(orientation: number): Uint8Array {
  const tiff = new Uint8Array(26);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00]); // "II*\0"
  view.setUint32(4, 8, true);
  view.setUint16(8, 1, true); // エントリ数
  view.setUint16(10, 0x0112, true);
  view.setUint16(12, 3, true); // SHORT
  view.setUint32(14, 1, true);
  view.setUint16(18, orientation, true);
  view.setUint32(22, 0, true); // 次のIFDなし
  return tiff;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type StripOptions = {
  /** 画像の向き（Orientation）だけは残す */
  keepOrientation: boolean;
};

/**
 * 画像データを再エンコードせずにメタデータを取り除く。
 * ICCプロファイルなど表示に必要な情報は保持する。
 */
export function stripImageMetadata(
  bytes: Uint8Array,
  options: StripOptions
): Uint8Array {
  const report = readImageMetadata(bytes);
  const orientation =
    options.keepOrientation && report.orientation && report.orientation !== 1
      ? report.orientation
      : null;

  if (report.format === "jpeg") {
    const { segments, scanStart } = readJpegSegments(bytes);
    const parts: Uint8Array[] = [bytes.subarray(0, 2)];
    let insertedOrientation = false;
    const insertOrientation = () => {
      if (!orientation || insertedOrientation) return;
      const tiff = buildOrientationTiff(orientation);
      const length = 2 + EXIF_HEADER.length + tiff.length;
      parts.push(
        new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, ...EXIF_HEADER]),
        tiff
      );
      insertedOrientation = true;
    };
    for (const segment of segments) {
      // APP1(EXIF/XMP)・APP13(IPTC)・COM(コメント)を除去する
      if (segment.marker === 0xe1 || segment.marker === 0xed || segment.marker === 0xfe) {
        continue;
      }
      if (segment.marker !== 0xe0) insertOrientation();
      parts.push(bytes.subarray(segment.start, segment.end));
    }
    insertOrientation();
    parts.push(bytes.subarray(scanStart));
    return concatBytes(parts);
  }

  if (report.format === "png") {
    const chunks = readPngChunks(bytes);
    const parts: Uint8Array[] = [bytes.subarray(0, 8)];
    for (const chunk of chunks) {
      if (PNG_METADATA_CHUNKS.has(chunk.type)) continue;
      parts.push(bytes.subarray(chunk.start, chunk.end));
      if (chunk.type === "IHDR" && orientation) {
        const tiff = buildOrientationTiff(orientation);
        const header = new Uint8Array(8);
        const headerView = new DataView(header.buffer);
        headerView.setUint32(0, tiff.length);
        header.set([0x65, 0x58, 0x49, 0x66], 4); // "eXIf"
        const crc = new Uint8Array(4);
        new DataView(crc.buffer).setUint32(0, crc32(concatBytes([header.subarray(4), tiff])));
        parts.push(header, tiff, crc);
      }
    }
    return concatBytes(parts);
  }

  const chunks = readWebpChunks(bytes);
  const parts: Uint8Array[] = [];
  for (const chunk of chunks) {
    if (chunk.type === "EXIF" || chunk.type === "XMP ") continue;
    const data = bytes.slice(chunk.start, chunk.end);
    if (chunk.type === "VP8X") {
      // EXIF(0x08)・XMP(0x04)フラグを落とす
      data[8] &= ~0x0c;
      if (orientation) data[8] |= 0x08;
    }
    parts.push(data);
  }
  if (orientation && chunks.some((chunk) => chunk.type === "VP8X")) {
    const tiff = buildOrientationTiff(orientation);
    const header = new Uint8Array(8);
    header.set([0x45, 0x58, 0x49, 0x46]); // "EXIF"
    new DataView(header.buffer).setUint32(4, tiff.length, true);
    parts.push(header, tiff);
  }
  const body = concatBytes(parts);
  const output = new Uint8Array(12 + body.length);
  output.set(bytes.subarray(0, 12));
  new DataView(output.buffer).setUint32(4, 4 + body.length, true);
  output.set(body, 12);
  return output;
}
