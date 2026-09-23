/**
 * UUID（v4・v7）・ULID・パスワードの生成。
 * 乱数はすべて暗号論的に安全な crypto.getRandomValues から取得する。
 */

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** 0以上 max 未満の一様な整数を返す（剰余による偏りを避けるため棄却法を使う） */
export function randomInt(max: number): number {
  if (max <= 0 || max > 2 ** 32) throw new RangeError("max out of range");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatUuid(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidV4(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

/**
 * UUID v7 の生成器。同じミリ秒内で連続して生成した場合も
 * 生成順にソートされるよう、rand_a（12ビット）をカウンターとして使う（RFC 9562 6.2 方式1）。
 */
export function createUuidV7Generator(now: () => number = Date.now) {
  let lastTimestamp = -1;
  let counter = 0;

  return function uuidV7(): string {
    let timestamp = now();
    if (timestamp <= lastTimestamp) {
      timestamp = lastTimestamp;
      counter += 1;
      if (counter > 0xfff) {
        timestamp += 1;
        counter = randomInt(0x800);
      }
    } else {
      // 同一ミリ秒内で十分な回数カウントアップできるよう、初期値は上位ビットを0にする
      counter = randomInt(0x800);
    }
    lastTimestamp = timestamp;

    const bytes = randomBytes(16);
    bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff;
    bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff;
    bytes[2] = (timestamp >>> 24) & 0xff;
    bytes[3] = (timestamp >>> 16) & 0xff;
    bytes[4] = (timestamp >>> 8) & 0xff;
    bytes[5] = timestamp & 0xff;
    bytes[6] = 0x70 | ((counter >>> 8) & 0x0f);
    bytes[7] = counter & 0xff;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuid(bytes);
  };
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * ULID の生成器。同じミリ秒内では乱数部を1ずつ増やして単調増加を保証する。
 */
export function createUlidGenerator(now: () => number = Date.now) {
  let lastTimestamp = -1;
  let lastRandom: number[] = [];

  return function ulid(): string {
    let timestamp = now();
    if (timestamp <= lastTimestamp) {
      timestamp = lastTimestamp;
      // 80ビットの乱数部（5ビット×16桁）をインクリメントする
      let index = lastRandom.length - 1;
      while (index >= 0 && lastRandom[index] === 31) {
        lastRandom[index] = 0;
        index -= 1;
      }
      if (index < 0) {
        timestamp += 1;
        lastRandom = Array.from({ length: 16 }, () => randomInt(32));
      } else {
        lastRandom[index] += 1;
      }
    } else {
      lastRandom = Array.from({ length: 16 }, () => randomInt(32));
    }
    lastTimestamp = timestamp;

    let time = "";
    let remaining = timestamp;
    for (let i = 0; i < 10; i += 1) {
      time = CROCKFORD[remaining % 32] + time;
      remaining = Math.floor(remaining / 32);
    }
    return time + lastRandom.map((value) => CROCKFORD[value]).join("");
  };
}

/** ULIDの先頭10文字からタイムスタンプ（ミリ秒）を取り出す */
export function decodeUlidTime(value: string): number | null {
  if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(value)) return null;
  let time = 0;
  for (const char of value.slice(0, 10).toUpperCase()) {
    time = time * 32 + CROCKFORD.indexOf(char);
  }
  return time;
}

/** UUID v7 からタイムスタンプ（ミリ秒）を取り出す */
export function decodeUuidV7Time(value: string): number | null {
  const hex = value.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex) || hex[12] !== "7") return null;
  return parseInt(hex.slice(0, 12), 16);
}

export type PasswordOptions = {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** 0/O、1/l/I など見間違えやすい文字を除外する */
  excludeAmbiguous: boolean;
};

const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>/?~",
} as const;

const AMBIGUOUS = new Set("0O1lI|`'\"".split(""));

function selectedSets(options: PasswordOptions): string[] {
  return (Object.keys(CHARSETS) as (keyof typeof CHARSETS)[])
    .filter((key) => options[key])
    .map((key) =>
      options.excludeAmbiguous
        ? CHARSETS[key]
            .split("")
            .filter((char) => !AMBIGUOUS.has(char))
            .join("")
        : CHARSETS[key]
    )
    .filter((set) => set.length > 0);
}

export function passwordPoolSize(options: PasswordOptions): number {
  return selectedSets(options).join("").length;
}

/** パスワードの理論上のエントロピー（ビット） */
export function passwordEntropy(options: PasswordOptions): number {
  const pool = passwordPoolSize(options);
  return pool > 0 ? options.length * Math.log2(pool) : 0;
}

/**
 * パスワードを生成する。選択した文字種はそれぞれ最低1文字ずつ含める。
 * 文字種が1つも選ばれていない場合は null を返す。
 */
export function generatePassword(options: PasswordOptions): string | null {
  const sets = selectedSets(options);
  if (sets.length === 0) return null;
  const pool = sets.join("");
  const length = Math.max(options.length, sets.length);

  const chars: string[] = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(pool[randomInt(pool.length)]);

  // Fisher–Yates でシャッフルし、必須文字の位置が偏らないようにする
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
