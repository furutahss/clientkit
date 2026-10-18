/** Unixのパーミッション（所有者・グループ・その他のrwx）の8進数表記とrwx表記を変換する */

export type ChmodError = "invalidChar" | "invalidLength" | "specialBits";

/** 0〜0o777のビット列を3桁の8進数にする */
export function toOctal(bits: number): string {
  return bits.toString(8).padStart(3, "0");
}

export function toSymbolic(bits: number): string {
  return "rwxrwxrwx"
    .split("")
    .map((char, index) => (bits & (1 << (8 - index)) ? char : "-"))
    .join("");
}

export function parseOctal(text: string): { bits: number } | { error: ChmodError } {
  const value = text.trim();
  if (!/^[0-7]*$/.test(value)) return { error: "invalidChar" };
  // 4桁目は setuid・setgid・スティッキービット（対象外）。先頭が0なら通常の権限として扱う
  if (value.length === 4) return value.startsWith("0") ? { bits: parseInt(value, 8) } : { error: "specialBits" };
  if (value.length !== 3) return { error: "invalidLength" };
  return { bits: parseInt(value, 8) };
}

/** rwxr-xr-x 形式。ls -l の先頭の種別（- や d）が付いた10文字も受け付ける */
export function parseSymbolic(text: string): { bits: number } | { error: ChmodError } {
  let value = text.trim();
  if (value.length === 10 && /^[-dlbcps]/.test(value)) value = value.slice(1);
  if (value.length !== 9) return { error: "invalidLength" };
  if (/[sStT]/.test(value)) return { error: "specialBits" };
  if (!/^([r-][w-][x-]){3}$/.test(value)) return { error: "invalidChar" };
  let bits = 0;
  for (let i = 0; i < 9; i++) if (value[i] !== "-") bits |= 1 << (8 - i);
  return { bits };
}
