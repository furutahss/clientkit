/** スキーマなしでProtocol Buffersのワイヤー形式をデコードする（フィールド番号・ワイヤータイプ・考えられる解釈を表示） */
export type PbField = { num: number; wire: number; interp: string[]; nested?: PbField[] };

function varint(b: Uint8Array, pos: number): [bigint, number] {
  let v = 0n, shift = 0n;
  for (let i = pos; i < b.length && i < pos + 10; i++) {
    v |= BigInt(b[i] & 0x7f) << shift;
    if (!(b[i] & 0x80)) return [v, i + 1];
    shift += 7n;
  }
  throw new Error("invalid varint");
}

const printable = (s: string) => /^[\p{L}\p{N}\p{P}\p{S}\p{Zs}\n\r\t]+$/u.test(s);

export function decodeProtobuf(b: Uint8Array, depth = 0): PbField[] {
  const out: PbField[] = [];
  let pos = 0;
  while (pos < b.length) {
    const [tag, p1] = varint(b, pos);
    const num = Number(tag >> 3n), wire = Number(tag & 7n);
    if (num === 0) throw new Error("field number 0 is invalid");
    pos = p1;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (wire === 0) {
      const [v, p] = varint(b, pos); pos = p;
      const zz = (v >> 1n) ^ -(v & 1n);
      out.push({ num, wire, interp: [`uint: ${v}`, `sint (zigzag): ${zz}`, `int64: ${BigInt.asIntN(64, v)}`, ...(v <= 1n ? [`bool: ${v === 1n}`] : [])] });
    } else if (wire === 1) {
      if (pos + 8 > b.length) throw new Error("truncated fixed64");
      out.push({ num, wire, interp: [`fixed64: ${dv.getBigUint64(pos, true)}`, `sfixed64: ${dv.getBigInt64(pos, true)}`, `double: ${dv.getFloat64(pos, true)}`] });
      pos += 8;
    } else if (wire === 5) {
      if (pos + 4 > b.length) throw new Error("truncated fixed32");
      out.push({ num, wire, interp: [`fixed32: ${dv.getUint32(pos, true)}`, `sfixed32: ${dv.getInt32(pos, true)}`, `float: ${dv.getFloat32(pos, true)}`] });
      pos += 4;
    } else if (wire === 2) {
      const [len, p] = varint(b, pos);
      const n = Number(len);
      if (p + n > b.length) throw new Error("truncated length-delimited field");
      const data = b.subarray(p, p + n);
      pos = p + n;
      const interp: string[] = [];
      let nested: PbField[] | undefined;
      if (n === 0) interp.push("empty (string / bytes / message)");
      else {
        let str: string | null = null;
        try { str = new TextDecoder("utf-8", { fatal: true }).decode(data); } catch { /* not utf-8 */ }
        if (str !== null && printable(str)) interp.push(`string: ${JSON.stringify(str)}`);
        if (depth < 8) { try { const m = decodeProtobuf(data, depth + 1); if (m.length && (str === null || !printable(str) || m.every((f) => f.num < 100))) nested = m; } catch { /* not a message */ } }
        if (nested) interp.push("embedded message");
        if (!interp.length || !str) interp.push(`bytes: ${Array.from(data.subarray(0, 32), (x) => x.toString(16).padStart(2, "0")).join(" ")}${n > 32 ? " …" : ""}`);
        if (n % 4 === 0 && n >= 4 && !nested && str === null) interp.push("maybe packed repeated (fixed32 / float)");
      }
      out.push({ num, wire, interp, nested });
    } else throw new Error(`unsupported wire type ${wire} (groups are not supported)`);
  }
  return out;
}

export function formatProtobuf(fields: PbField[], indent = ""): string {
  const names = ["varint", "fixed64", "len", "sgroup", "egroup", "fixed32"];
  return fields.map((f) => `${indent}${f.num}: [${names[f.wire]}] ${f.interp.join(" | ")}${f.nested ? "\n" + formatProtobuf(f.nested, indent + "  ") : ""}`).join("\n");
}
