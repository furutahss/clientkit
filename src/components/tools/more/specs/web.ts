import { analyzeAccessLog } from "@/lib/more/access-log";
import { analyzeEmailAuth } from "@/lib/more/email-auth";
import { authResults, decodeMimeWords, domainOf, parseMailHeaders, parseReceived } from "@/lib/more/email-header";
import { analyzeHeaders, explainCacheControl, parseHeaders } from "@/lib/more/http-headers";
import { checkMeta, extractMeta } from "@/lib/more/html-meta";
import { classifyIPv6, compressIPv6, expandIPv6, parseIPv6, parseIPv6Cidr, reverseDnsIPv6 } from "@/lib/more/ipv6";
import { validateJsonLd } from "@/lib/more/jsonld";
import { decodeSaml, prettySaml, summarizeSaml } from "@/lib/more/saml";
import { validateSitemap } from "@/lib/more/sitemap";
import { sriHash, sriTags, type SriAlgo } from "@/lib/more/sri";
import { textOrFile, utf8 } from "@/lib/more/util";
import { checkWebhook, type Algo, type Provider } from "@/lib/more/webhook";

import { countNote, findingsTable, type Specs } from "./shared";

export const specs: Specs = {
  "http-header-analyzer": {
    inputs: [{ id: "text", label: ["HTTPヘッダー（レスポンスをそのまま貼り付け）", "HTTP headers (paste a raw response)"], rows: 10, placeholder: "HTTP/2 200\nstrict-transport-security: max-age=31536000\nset-cookie: sid=abc; Path=/" }],
    sample: { text: "HTTP/2 200\ncontent-type: text/html\ncache-control: public, max-age=3600, immutable\ncontent-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'\naccess-control-allow-origin: *\naccess-control-allow-credentials: true\nset-cookie: sid=abc123; Path=/; SameSite=None\nserver: nginx/1.25.3" },
    run: ({ inputs, t }) => {
      const headers = parseHeaders(inputs.text);
      if (!headers.length) return { error: t("ヘッダー行（Name: value）が見つかりません。", "No header lines (Name: value) found.") };
      const findings = analyzeHeaders(headers, t);
      const cc = headers.find((h) => h.name.toLowerCase() === "cache-control");
      return {
        notes: [countNote(t, findings), ...(cc ? [t("Cache-Control の意味:", "Cache-Control meaning:"), ...explainCacheControl(cc.value, t)] : [])],
        tables: [findingsTable(findings, (f) => f.area, [t("レベル", "Level"), t("対象", "Target"), t("内容", "Message")])],
      };
    },
  },

  "ogp-checker": {
    inputs: [{ id: "html", label: ["HTML（<head>を含む）", "HTML (including <head>)"], rows: 10 }],
    files: { accept: ".html,.htm,text/html", label: ["HTMLファイルをドロップ（任意）", "Drop an HTML file (optional)"] },
    sample: { html: '<!doctype html><html lang="ja"><head><title>サンプルページ</title><meta name="description" content="サンプルの説明文です。"><link rel="canonical" href="/sample"><meta property="og:title" content="サンプル"><meta property="og:image" content="/ogp.png"><meta name="twitter:card" content="summary_large_image"></head></html>' },
    run: ({ inputs, files, t }) => {
      const meta = extractMeta(textOrFile(inputs.html, files));
      const findings = checkMeta(meta, t);
      return {
        notes: [countNote(t, findings)],
        tables: [
          findingsTable(findings, (f) => f.item, [t("レベル", "Level"), t("項目", "Item"), t("内容", "Message")]),
          { title: t("検出したタグ", "Detected tags"), head: ["name / property", "content"], rows: [["title", meta.title], ["lang", meta.lang], ["canonical", meta.canonical], ...meta.tags.map((x) => [x.key, x.value])] },
        ],
      };
    },
  },

  "jsonld-validator": {
    inputs: [{ id: "html", label: ["HTML または JSON-LD", "HTML or JSON-LD"], rows: 10 }],
    files: { accept: ".html,.htm,.json,.jsonld", label: ["HTML / JSONファイルをドロップ（任意）", "Drop an HTML / JSON file (optional)"] },
    sample: { html: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"記事タイトル","datePublished":"2026-01-05"}</script>' },
    run: ({ inputs, files, t }) => {
      const { findings, summary } = validateJsonLd(textOrFile(inputs.html, files), t);
      return {
        notes: [t(`検出したタイプ: ${summary.join(", ") || "なし"}`, `Detected types: ${summary.join(", ") || "none"}`), countNote(t, findings)],
        tables: [findingsTable(findings, (f) => f.type, [t("レベル", "Level"), t("タイプ", "Type"), t("内容", "Message")])],
      };
    },
  },

  "sitemap-validator": {
    inputs: [{ id: "xml", label: ["sitemap.xml の内容", "sitemap.xml contents"], rows: 10 }],
    files: { accept: ".xml,text/xml,application/xml", label: ["sitemap.xml をドロップ（任意）", "Drop a sitemap.xml (optional)"] },
    sample: { xml: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc><lastmod>2026-01-05</lastmod><priority>1.0</priority></url>\n  <url><loc>https://example.com/about?x=1&y=2</loc><lastmod>2026/01/05</lastmod></url>\n  <url><loc>https://example.com/</loc></url>\n</urlset>' },
    run: ({ inputs, files, t }) => {
      const r = validateSitemap(textOrFile(inputs.xml, files), t);
      return { notes: [t(`種類: ${r.kind} / エントリ数: ${r.count}`, `Type: ${r.kind} / Entries: ${r.count}`), countNote(t, r.findings)], tables: [findingsTable(r.findings, (f) => f.target, [t("レベル", "Level"), t("対象", "Target"), t("内容", "Message")])] };
    },
  },

  "email-auth-checker": {
    inputs: [{ id: "text", label: ["SPF / DKIM / DMARC のTXTレコード（1行1レコード）", "SPF / DKIM / DMARC TXT records (one per line)"], rows: 6 }],
    sample: { text: "v=spf1 include:_spf.google.com include:sendgrid.net ~all\nv=DMARC1; p=none; rua=mailto:dmarc@example.com" },
    run: ({ inputs, t }) => {
      const findings = analyzeEmailAuth(inputs.text, t);
      return { notes: [countNote(t, findings)], tables: [findingsTable(findings, (f) => f.record, [t("レベル", "Level"), t("種類", "Record"), t("内容", "Message")])] };
    },
  },

  "email-header-analyzer": {
    inputs: [{ id: "text", label: ["メールヘッダー（ソース表示から貼り付け）", "Email headers (paste from “show original”)"], rows: 10 }],
    files: { accept: ".eml,message/rfc822,text/plain", label: [".eml ファイルをドロップ（任意）", "Drop an .eml file (optional)"] },
    sample: { text: "Received: from mx.example.org (mx.example.org [203.0.113.9]) by mail.example.com with ESMTPS; Tue, 3 Nov 2026 10:00:42 +0000\nReceived: from sender.example.net (sender.example.net [198.51.100.2]) by mx.example.org with SMTP; Tue, 3 Nov 2026 10:00:05 +0000\nAuthentication-Results: mail.example.com; spf=pass smtp.mailfrom=example.net; dkim=pass header.d=example.net; dmarc=pass\nFrom: Alice <alice@example.net>\nReturn-Path: <bounce@mailer.example.org>\nSubject: =?UTF-8?B?44GT44KT44Gr44Gh44Gv?=\nDate: Tue, 3 Nov 2026 10:00:00 +0000" },
    run: ({ inputs, files, t }) => {
      const headers = parseMailHeaders(textOrFile(inputs.text, files));
      if (!headers.length) return { error: t("ヘッダーが見つかりません。", "No headers found.") };
      const hops = parseReceived(headers);
      const auth = authResults(headers);
      const val = (n: string) => headers.find((h) => h.name.toLowerCase() === n)?.value ?? "";
      const notes: string[] = [];
      const from = domainOf(val("from"));
      const rp = domainOf(val("return-path"));
      if (from && rp && from !== rp && !rp.endsWith("." + from) && !from.endsWith("." + rp)) notes.push(t(`From（${from}）と Return-Path（${rp}）のドメインが異なります。転送サービスや配信代行なら正常ですが、なりすましの可能性もあります。`, `The From domain (${from}) differs from Return-Path (${rp}). Normal for forwarders and bulk senders, but also a sign of spoofing.`));
      const rt = domainOf(val("reply-to"));
      if (from && rt && from !== rt) notes.push(t(`Reply-To のドメイン（${rt}）が From と異なります。`, `The Reply-To domain (${rt}) differs from From.`));
      for (const a of auth) if (["fail", "softfail", "permerror", "temperror"].includes(a.result)) notes.push(t(`${a.method.toUpperCase()} が ${a.result} です。`, `${a.method.toUpperCase()} is ${a.result}.`));
      const total = hops.length > 1 && hops[0].date && hops[hops.length - 1].date ? Math.round((hops[hops.length - 1].date!.getTime() - hops[0].date.getTime()) / 1000) : null;
      if (total !== null) notes.push(t(`最初のサーバーから最後のサーバーまで ${total} 秒です。`, `${total} seconds from the first to the last server.`));
      return {
        notes,
        tables: [
          { title: t("経路（古い順）", "Route (oldest first)"), head: ["#", "from", "by", "with", t("日時", "Date"), t("遅延(秒)", "Delay (s)")], rows: hops.map((h) => [h.index, h.from, h.by, h.with, h.date ? h.date.toISOString() : "?", h.delaySec ?? "-"]) },
          { title: t("認証結果", "Authentication results"), head: [t("方式", "Method"), t("結果", "Result")], rows: auth.map((a) => [a.method, a.result]) },
          { title: t("主なヘッダー", "Key headers"), head: ["Header", "Value"], rows: ["from", "to", "reply-to", "return-path", "subject", "date", "message-id"].filter(val).map((n) => [n, decodeMimeWords(val(n))]) },
        ],
      };
    },
  },

  "ipv6-calculator": {
    inputs: [{ id: "text", label: ["IPv6アドレス または CIDR（1行1件）", "IPv6 address or CIDR (one per line)"], rows: 5, placeholder: "2001:db8::1/64" }],
    options: [{ id: "contains", kind: "text", label: ["含まれるか確認するアドレス（任意）", "Address to test for membership (optional)"], default: "" }],
    sample: { text: "2001:db8:abcd:12::1/48\nfe80::1ff:fe23:4567:890a\n::ffff:192.0.2.1" },
    run: ({ inputs, opts, t }) => {
      const rows: (string | number)[][] = [];
      const probe = String(opts.contains).trim() ? parseIPv6(String(opts.contains)) : null;
      for (const line of inputs.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        const c = parseIPv6Cidr(line);
        if (!c) { rows.push([line, t("解析できません", "cannot parse"), "", "", "", ""]); continue; }
        const inRange = probe === null ? "-" : probe >= c.first && probe <= c.last ? t("含まれる", "inside") : t("含まれない", "outside");
        rows.push([line, `${compressIPv6(c.first)}/${c.prefix}`, `${expandIPv6(c.first)} – ${expandIPv6(c.last)}`, c.total.toLocaleString("en-US") + (c.prefix <= 64 ? ` (/64 × ${c.slash64s.toLocaleString("en-US")})` : ""), classifyIPv6(c.first), `${reverseDnsIPv6(c.first)}${inRange === "-" ? "" : ` / ${inRange}`}`]);
      }
      return { tables: [{ head: [t("入力", "Input"), t("ネットワーク（短縮）", "Network (compressed)"), t("範囲（展開）", "Range (expanded)"), t("アドレス数", "Addresses"), t("種別", "Type"), t("逆引き / 判定", "Reverse DNS / test")], rows }] };
    },
  },

  "access-log-analyzer": {
    inputs: [{ id: "text", label: ["アクセスログ（nginx / Apache combined、ALB）", "Access log (nginx / Apache combined, ALB)"], rows: 10 }],
    files: { accept: ".log,.txt,text/plain", label: ["ログファイルをドロップ（任意）", "Drop a log file (optional)"] },
    sample: { text: '203.0.113.5 - - [10/Oct/2026:13:55:36 +0900] "GET /index.html HTTP/1.1" 200 2326 "-" "Mozilla/5.0" 0.012\n203.0.113.5 - - [10/Oct/2026:13:55:37 +0900] "GET /missing HTTP/1.1" 404 153 "-" "Mozilla/5.0" 0.003\n198.51.100.7 - - [10/Oct/2026:13:55:40 +0900] "POST /api/orders HTTP/1.1" 502 0 "-" "curl/8.4" 2.500' },
    run: ({ inputs, files, t }) => {
      const r = analyzeAccessLog(textOrFile(inputs.text, files));
      if (!r.parsed) return { error: t("解析できる行がありません。", "No parsable lines.") };
      const c = (title: string, a: string, rows: [string, number][]) => ({ title, head: [a, t("件数", "Count")], rows });
      return {
        notes: [t(`${r.total} 行中 ${r.parsed} 行を解析（失敗 ${r.failed}）。転送量 ${r.bytes.toLocaleString()} バイト。期間 ${r.first} 〜 ${r.last}`, `Parsed ${r.parsed} of ${r.total} lines (${r.failed} failed). ${r.bytes.toLocaleString()} bytes sent. ${r.first} – ${r.last}`)],
        tables: [
          c(t("ステータス", "Status classes"), t("分類", "Class"), r.statuses),
          c(t("アクセス数の多いパス", "Top paths"), "path", r.topPaths),
          c(t("アクセス数の多いIP", "Top IPs"), "IP", r.topIps),
          ...(r.errorPaths.length ? [c(t("5xx エラー", "5xx errors"), t("ステータス・パス", "Status / path"), r.errorPaths)] : []),
          ...(r.notFound.length ? [c(t("404 のパス", "404 paths"), "path", r.notFound)] : []),
          ...(r.slowest.length ? [{ title: t("遅いリクエスト", "Slowest requests"), head: [t("秒", "Seconds"), "status", "method", "path", "IP"], rows: r.slowest.map((e) => [e.seconds!, e.status, e.method, e.path, e.ip]) }] : []),
        ],
      };
    },
  },

  "saml-decoder": {
    inputs: [{ id: "text", label: ["SAMLRequest / SAMLResponse（Base64、またはURLのクエリ）", "SAMLRequest / SAMLResponse (Base64 or URL query)"], rows: 8 }],
    safetyNote: ["SAMLの内容はこのブラウザ内でだけ解析します。署名の検証は行いません。", "SAML data is decoded only in this browser. Signatures are not verified."],
    outputLabel: ["XML（整形済み）", "XML (formatted)"],
    run: ({ inputs, t }) => {
      try {
        const { xml, deflated } = decodeSaml(inputs.text);
        const rows = summarizeSaml(xml).map((s) => [s.label, s.value]);
        return { notes: [deflated ? t("Redirect binding（deflate + Base64）として復元しました。", "Decoded as Redirect binding (deflate + Base64).") : t("Base64として復元しました。", "Decoded as Base64."), t("署名の検証・有効期限の判定は行いません。値は目視で確認してください。", "Signatures and validity are not verified. Review the values manually.")], tables: [{ head: [t("項目", "Field"), t("値", "Value")], rows }], text: prettySaml(xml) };
      } catch (e) {
        return { error: (e as Error).message === "not-base64" ? t("Base64として解釈できません。", "The input is not valid Base64.") : t("XMLとして復元できません（Base64 または deflate+Base64 の形式か確認してください）。", "Could not recover XML (check that it is Base64 or deflate+Base64).") };
      }
    },
  },

  "sri-generator": {
    inputs: [{ id: "text", label: ["ファイルの内容（またはファイルをドロップ）", "File contents (or drop a file)"], rows: 6 }],
    files: { label: ["JS / CSS ファイルをドロップ", "Drop a JS / CSS file"] },
    options: [
      { id: "algos", kind: "select", label: ["アルゴリズム", "Algorithms"], default: "sha384", choices: [{ value: "sha256", label: "SHA-256" }, { value: "sha384", label: "SHA-384" }, { value: "sha512", label: "SHA-512" }, { value: "all", label: ["3つすべて（スペース区切り）", "All three (space separated)"] }] },
      { id: "url", kind: "text", label: ["配布URL（タグ生成用）", "Hosted URL (for the tag)"], default: "https://cdn.example.com/lib.min.js" },
    ],
    run: async ({ inputs, files, opts, t }) => {
      const data = files[0]?.bytes ?? utf8(inputs.text);
      const algos: SriAlgo[] = opts.algos === "all" ? ["sha256", "sha384", "sha512"] : [opts.algos as SriAlgo];
      const integrity = (await Promise.all(algos.map((a) => sriHash(data, a)))).join(" ");
      const url = String(opts.url);
      const kind = /\.css(\?|$)/i.test(url) || /\.css$/i.test(files[0]?.name ?? "") ? "style" : "script";
      return { notes: [t("ハッシュは配布されるファイルとバイト単位で一致する必要があります（改行コードやBOMの違いに注意）。", "The hash must match the served bytes exactly (watch for line endings and BOMs).")], text: `integrity="${integrity}"\n\n${sriTags(url, integrity, kind)}` };
    },
  },

  "webhook-signature": {
    inputs: [
      { id: "payload", label: ["ペイロード（リクエストボディ、加工前のまま）", "Payload (raw request body, unmodified)"], rows: 6 },
      { id: "signature", label: ["受け取った署名ヘッダーの値（任意）", "Received signature header value (optional)"], rows: 2 },
    ],
    options: [
      { id: "provider", kind: "select", label: ["方式", "Scheme"], default: "github", choices: [{ value: "github", label: "GitHub (X-Hub-Signature-256)" }, { value: "stripe", label: "Stripe (Stripe-Signature)" }, { value: "slack", label: "Slack (X-Slack-Signature)" }, { value: "generic", label: ["汎用HMAC", "Generic HMAC"] }] },
      { id: "secret", kind: "text", label: ["シークレット", "Secret"], default: "", secret: true },
      { id: "timestamp", kind: "text", label: ["タイムスタンプ（Slackの X-Slack-Request-Timestamp）", "Timestamp (Slack X-Slack-Request-Timestamp)"], default: "", hidden: (v) => v.provider !== "slack" },
      { id: "algo", kind: "select", label: ["ハッシュ", "Hash"], default: "SHA-256", choices: ["SHA-1", "SHA-256", "SHA-384", "SHA-512"].map((v) => ({ value: v, label: v })), hidden: (v) => v.provider !== "generic" },
      { id: "encoding", kind: "select", label: ["出力形式", "Encoding"], default: "hex", choices: [{ value: "hex", label: "hex" }, { value: "base64", label: "base64" }], hidden: (v) => v.provider !== "generic" },
    ],
    safetyNote: ["シークレットとペイロードはこのブラウザ内でだけ使われ、送信・保存されません。", "The secret and payload are used only in this browser and never sent or stored."],
    run: async ({ inputs, opts, t }) => {
      if (!String(opts.secret)) return { error: t("シークレットを入力してください。", "Enter the secret.") };
      const r = await checkWebhook({ provider: opts.provider as Provider, secret: String(opts.secret), payload: inputs.payload, signature: inputs.signature, timestamp: String(opts.timestamp), algo: opts.algo as Algo, encoding: opts.encoding as "hex" | "base64" });
      const notes = r.notes.map((n) => ({ "missing-timestamp": t("タイムスタンプがありません。", "The timestamp is missing."), "stale-timestamp": t("タイムスタンプが現在時刻から5分以上ずれています（リプレイ攻撃対策として拒否すべき状態です）。", "The timestamp is more than 5 minutes from now (should be rejected to prevent replay attacks)."), "multiple-v1": t("v1署名が複数あります（シークレットのローテーション中）。いずれか1つが一致すれば有効です。", "Multiple v1 signatures (secret rotation). Any single match is valid.") })[n] ?? n);
      if (r.match !== null) notes.unshift(r.match ? t("✔ 署名が一致しました。", "✔ The signature matches.") : t("✖ 署名が一致しません。ペイロードが加工されていないか（改行・文字コード・JSON再整形）、シークレットが正しいか確認してください。", "✖ The signature does not match. Check that the payload is byte-for-byte unmodified (newlines, encoding, JSON re-formatting) and that the secret is correct."));
      return { notes, text: `computed: ${r.computed}\nexpected: ${r.expected || "-"}\n\nsigned payload:\n${r.signedPayload}` };
    },
  },
};
