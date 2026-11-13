import { base64ToBytes, readTlv } from "./util";
import type { T } from "./types";

export type EmailFinding = { level: "error" | "warn" | "info" | "ok"; record: string; message: string };

export function parseTags(record: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const part of record.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) { const k = part.slice(0, i).trim().toLowerCase(); if (!m.has(k)) m.set(k, part.slice(i + 1).trim()); }
  }
  return m;
}

/** SPFのDNS参照回数（include / a / mx / ptr / exists / redirect）。include先の中身は数えられない */
export function countSpfLookups(spf: string): number {
  return spf.split(/\s+/).filter((tok) => /^[+\-~?]?(include:|a(:|\/|$)|mx(:|\/|$)|ptr(:|$)|exists:)/i.test(tok) || /^redirect=/i.test(tok)).length;
}

function rsaBits(spkiB64: string): number | null {
  const der = base64ToBytes(spkiB64);
  if (!der) return null;
  const seq = readTlv(der, 0);
  if (!seq || seq.tag !== 0x30) return null;
  const alg = readTlv(der, seq.start);
  if (!alg) return null;
  const bit = readTlv(der, alg.end);
  if (!bit || bit.tag !== 0x03) return null;
  const inner = readTlv(der, bit.start + 1);
  const n = inner && readTlv(der, inner.start);
  if (!n || n.tag !== 0x02) return null;
  let len = n.len;
  if (der[n.start] === 0) len -= 1;
  return len * 8;
}

export function analyzeEmailAuth(input: string, t: T): EmailFinding[] {
  const f: EmailFinding[] = [];
  const records = input.split(/\r?\n/).map((l) => l.trim().replace(/^"|"$/g, "").replace(/"\s*"/g, "")).filter(Boolean);
  const add = (level: EmailFinding["level"], record: string, ja: string, en: string) => f.push({ level, record, message: t(ja, en) });
  for (const rec of records) {
    if (/^v=spf1\b/i.test(rec)) {
      const toks = rec.split(/\s+/);
      const all = toks.filter((x) => /^[+\-~?]?all$/i.test(x));
      const lookups = countSpfLookups(rec);
      if (!all.length && !toks.some((x) => /^redirect=/i.test(x))) add("warn", "SPF", "all も redirect もありません。末尾に -all か ~all を付けてください。", "Neither all nor redirect is present. End the record with -all or ~all.");
      if (all.length > 1) add("error", "SPF", "all が複数あります。", "There is more than one all mechanism.");
      const allTok = all[0]?.toLowerCase();
      if (allTok === "all" || allTok === "+all") add("error", "SPF", "+all は誰でも送信元として許可してしまいます。", "+all authorizes anyone to send as this domain.");
      else if (allTok === "?all") add("warn", "SPF", "?all は判定を中立にするだけで、なりすまし対策になりません。", "?all is neutral and gives no protection against spoofing.");
      else if (allTok === "~all") add("info", "SPF", "~all（ソフトフェイル）です。運用が安定したら -all を検討してください。", "~all is soft-fail. Consider -all once your senders are stable.");
      else if (allTok === "-all") add("ok", "SPF", "-all（ハードフェイル）です。", "-all is hard-fail.");
      if (all.length && toks.indexOf(all[0]) < toks.length - 1 && !toks.slice(toks.indexOf(all[0]) + 1).every((x) => /^redirect=/i.test(x))) add("warn", "SPF", "all より後ろのメカニズムは評価されません。", "Mechanisms after all are never evaluated.");
      if (/(^|\s)[+\-~?]?ptr\b/i.test(rec)) add("warn", "SPF", "ptr は非推奨で、負荷も高くなります。", "ptr is deprecated and expensive.");
      if (lookups > 10) add("error", "SPF", `DNS参照が${lookups}回あり、上限10回を超えています（PermError）。`, `${lookups} DNS lookups exceed the limit of 10 (PermError).`);
      else add(lookups >= 8 ? "warn" : "ok", "SPF", `直接のDNS参照は${lookups}回です。include先でも数えるため、上限10回に注意してください。`, `${lookups} direct DNS lookups. Lookups inside includes also count toward the limit of 10.`);
      if (rec.length > 255) add("info", "SPF", "255文字を超えるため、DNSでは複数の文字列に分割して登録します。", "Longer than 255 characters: publish it as multiple quoted strings in DNS.");
    } else if (/^v=DMARC1\b/i.test(rec)) {
      const tags = parseTags(rec);
      const p = tags.get("p")?.toLowerCase();
      if (!p) add("error", "DMARC", "必須タグ p がありません。", "The required p tag is missing.");
      else if (!["none", "quarantine", "reject"].includes(p)) add("error", "DMARC", `p の値が不正です（${p}）。`, `p has an invalid value (${p}).`);
      else if (p === "none") add("warn", "DMARC", "p=none は監視のみで、なりすましメールを拒否しません。", "p=none only monitors and does not reject spoofed mail.");
      else add("ok", "DMARC", `p=${p} です。`, `p=${p}.`);
      const sp = tags.get("sp")?.toLowerCase();
      if (sp && !["none", "quarantine", "reject"].includes(sp)) add("error", "DMARC", `sp の値が不正です（${sp}）。`, `sp has an invalid value (${sp}).`);
      if (!tags.has("rua")) add("info", "DMARC", "rua（集計レポートの送信先）がありません。", "rua (aggregate report address) is not set.");
      else if (!/^mailto:/i.test(tags.get("rua")!.split(",")[0].trim())) add("error", "DMARC", "rua は mailto: で始めてください。", "rua must start with mailto:.");
      const pct = tags.get("pct");
      if (pct !== undefined && (!/^\d+$/.test(pct) || Number(pct) > 100)) add("error", "DMARC", "pct は0〜100の整数です。", "pct must be an integer from 0 to 100.");
      else if (pct !== undefined && Number(pct) < 100) add("info", "DMARC", `pct=${pct} のため、一部のメールにしかポリシーが適用されません。`, `pct=${pct}: the policy applies to only part of your mail.`);
      for (const k of ["adkim", "aspf"]) if (tags.has(k) && !["r", "s"].includes(tags.get(k)!.toLowerCase())) add("error", "DMARC", `${k} は r か s です。`, `${k} must be r or s.`);
      if (!/^v=DMARC1\s*;/i.test(rec)) add("error", "DMARC", "先頭は v=DMARC1; でなければなりません。", "The record must start with v=DMARC1;.");
    } else if (/^v=DKIM1\b/i.test(rec) || /(^|;)\s*p=/i.test(rec)) {
      const tags = parseTags(rec);
      const key = (tags.get("p") ?? "").replace(/\s+/g, "");
      const k = (tags.get("k") ?? "rsa").toLowerCase();
      if (!tags.has("p")) add("error", "DKIM", "公開鍵 p がありません。", "The public key tag p is missing.");
      else if (!key) add("warn", "DKIM", "p が空です。この鍵は失効（revoke）扱いです。", "p is empty. This key is treated as revoked.");
      else if (k === "rsa") {
        const bits = rsaBits(key);
        if (!bits) add("error", "DKIM", "公開鍵をRSA SPKIとして解析できません。", "The public key cannot be parsed as an RSA SPKI.");
        else add(bits < 1024 ? "error" : bits < 2048 ? "warn" : "ok", "DKIM", `RSA ${bits}ビットです${bits < 2048 ? "。2048ビット以上を推奨します" : ""}。`, `RSA ${bits}-bit${bits < 2048 ? ". 2048 bits or more is recommended" : ""}.`);
      } else if (k === "ed25519") add("ok", "DKIM", "Ed25519鍵です（受信側の対応が限られる場合があります）。", "Ed25519 key (some receivers may not support it).");
      else add("error", "DKIM", `k の値が不正です（${k}）。`, `k has an invalid value (${k}).`);
      if (tags.get("t")?.split(":").includes("y")) add("warn", "DKIM", "t=y（テストモード）です。本番では外してください。", "t=y (testing mode). Remove it in production.");
      if (tags.has("v") && tags.get("v") !== "DKIM1") add("error", "DKIM", "v は DKIM1 でなければなりません。", "v must be DKIM1.");
    } else add("error", "?", `SPF / DMARC / DKIM のレコードとして認識できません: ${rec.slice(0, 60)}`, `Not recognized as an SPF / DMARC / DKIM record: ${rec.slice(0, 60)}`);
  }
  return f;
}
