import { computeCheckDigit, validateCheckDigit, type CheckType } from "@/lib/more/checkdigit";
import { explainIamPolicy } from "@/lib/more/iam";
import { inspectId } from "@/lib/more/id-inspect";
import { signJwt, verifyJwt, type JwtAlg } from "@/lib/more/jwt-sign";
import { convertKey, generateKeyPair, type KeyKind } from "@/lib/more/keys";
import { inspectSshKey } from "@/lib/more/ssh-key";
import { decryptText, encryptText } from "@/lib/more/text-crypto";
import { parseOtpauth, totpWindows } from "@/lib/more/totp";
import { parseCsrPem } from "@/lib/x509";

import { countNote, findingsTable, type Specs } from "./shared";

const ALGS = ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "ES256", "ES384", "ES512"];

export const specs: Specs = {
  "jwt-signer": {
    inputs: [
      { id: "main", label: ["ペイロードJSON（署名時）／ JWT（検証時）", "Payload JSON (sign) / JWT (verify)"], rows: 6 },
      { id: "key", label: ["鍵: HS系はシークレット文字列、RS/ES系は PKCS#8 秘密鍵PEM（署名）・SPKI公開鍵PEM（検証）またはJWK", "Key: secret string for HS*, PKCS#8 private PEM (sign) / SPKI public PEM (verify) or JWK for RS*/ES*"], rows: 5 },
    ],
    options: [
      { id: "mode", kind: "select", label: ["操作", "Action"], default: "sign", choices: [{ value: "sign", label: ["署名して作成", "Sign"] }, { value: "verify", label: ["署名を検証", "Verify"] }] },
      { id: "alg", kind: "select", label: ["アルゴリズム", "Algorithm"], default: "HS256", choices: ALGS.map((v) => ({ value: v, label: v })) },
      { id: "header", kind: "text", label: ["追加ヘッダーJSON（algは自動設定）", "Extra header JSON (alg is set automatically)"], default: '{"typ":"JWT"}', hidden: (v) => v.mode !== "sign" },
    ],
    sample: { main: '{"sub":"1234567890","name":"John Doe","iat":1516239022}', key: "your-256-bit-secret" },
    safetyNote: ["鍵とトークンはこのブラウザ内（Web Crypto API）だけで処理され、送信・保存されません。", "Keys and tokens are processed only in this browser (Web Crypto API) and never sent or stored."],
    run: async ({ inputs, opts, t }) => {
      const alg = opts.alg as JwtAlg;
      if (!inputs.key.trim()) return { error: t("鍵を入力してください。", "Enter a key.") };
      try {
        if (opts.mode === "sign") return { text: await signJwt(String(opts.header) || "{}", inputs.main, alg, inputs.key) };
        const r = await verifyJwt(inputs.main, inputs.key, alg);
        const msg: Record<string, string> = { expired: t("exp を過ぎています（期限切れ）。", "exp has passed (expired)."), "not-expired": t("exp はまだ先です。", "exp is in the future."), "not-yet-valid": t("nbf より前です（まだ有効ではありません）。", "Before nbf (not valid yet)."), "valid-from": t("nbf を過ぎています。", "nbf has passed.") };
        return {
          notes: [r.valid ? t("✔ 署名は正しいです。", "✔ The signature is valid.") : t("✖ 署名が正しくありません（鍵・アルゴリズム・トークンを確認してください）。", "✖ The signature is NOT valid (check the key, algorithm, and token)."), ...r.claims.map((c) => c.message.startsWith("alg-mismatch") ? t(`トークンの alg は ${c.message.split(":")[1]} ですが、選択したアルゴリズムは ${alg} です。alg を信用せず、必ず期待するアルゴリズムで検証してください。`, `The token's alg is ${c.message.split(":")[1]} but you selected ${alg}. Never trust the token's alg; always verify with the expected algorithm.`) : `${c.name}: ${msg[c.message] ?? c.message}`)],
          text: JSON.stringify({ header: r.header, payload: r.payload }, null, 2),
        };
      } catch (e) {
        const m = (e as Error).message;
        const known: Record<string, string> = { "bad-key": t("鍵をPEMまたはJWKとして読み取れません。", "Could not read the key as PEM or JWK."), "need-pkcs8": t("署名には PKCS#8 の秘密鍵（BEGIN PRIVATE KEY）が必要です。", "Signing needs a PKCS#8 private key (BEGIN PRIVATE KEY)."), "need-spki": t("検証には公開鍵（BEGIN PUBLIC KEY）が必要です。", "Verifying needs a public key (BEGIN PUBLIC KEY)."), "bad-token": t("JWTの形式が正しくありません。", "The JWT format is invalid.") };
        return { error: known[m] ?? (e instanceof SyntaxError ? t("JSONの形式が正しくありません。", "Invalid JSON.") : m) };
      }
    },
  },

  "key-converter": {
    inputs: [{ id: "key", label: ["変換する鍵（PEM: PUBLIC KEY / PRIVATE KEY、またはJWK）", "Key to convert (PEM: PUBLIC KEY / PRIVATE KEY, or JWK)"], rows: 8 }],
    options: [
      { id: "mode", kind: "select", label: ["操作", "Action"], default: "convert", choices: [{ value: "convert", label: ["PEM ⇄ JWK 変換", "PEM ⇄ JWK convert"] }, { value: "generate", label: ["鍵ペアを生成", "Generate a key pair"] }] },
      { id: "kind", kind: "select", label: ["鍵の種類", "Key type"], default: "ec-p256", choices: ["rsa-2048", "rsa-3072", "rsa-4096", "ec-p256", "ec-p384", "ec-p521", "ed25519"].map((v) => ({ value: v, label: v.toUpperCase().replace("-", " ") })), hidden: (v) => v.mode !== "generate" },
    ],
    manual: ["実行", "Run"],
    runWithoutInput: true,
    safetyNote: ["鍵はこのブラウザ内（Web Crypto API）で生成・変換され、送信・保存されません。生成した秘密鍵は安全な場所に保管してください。", "Keys are generated and converted in this browser (Web Crypto API) and never sent or stored. Keep generated private keys safe."],
    run: async ({ inputs, opts, t }) => {
      try {
        const k = opts.mode === "generate" ? await generateKeyPair(opts.kind as KeyKind) : await convertKey(inputs.key);
        const parts = [`# ${t("公開鍵 (SPKI PEM)", "Public key (SPKI PEM)")}\n${k.publicPem}`, `# ${t("公開鍵 (JWK)", "Public key (JWK)")}\n${JSON.stringify(k.publicJwk, null, 2)}`];
        if (k.privatePem) parts.push(`# ${t("秘密鍵 (PKCS#8 PEM)", "Private key (PKCS#8 PEM)")}\n${k.privatePem}`, `# ${t("秘密鍵 (JWK)", "Private key (JWK)")}\n${JSON.stringify(k.privateJwk, null, 2)}`);
        return { notes: k.privatePem ? [t("秘密鍵が含まれます。共有しないでください。", "This includes a private key. Do not share it.")] : [], text: parts.join("\n\n") };
      } catch (e) {
        const m = (e as Error).message;
        if (m === "not-pem") return { error: t("PEMまたはJWKとして読み取れません。", "Could not read the input as PEM or JWK.") };
        if (m.startsWith("unsupported-label")) return { error: t(`この形式（${m.split(":")[1]}）は未対応です。PKCS#8（BEGIN PRIVATE KEY）か公開鍵（BEGIN PUBLIC KEY）に変換してください: openssl pkcs8 -topk8 -nocrypt -in key.pem`, `This format (${m.split(":")[1]}) is not supported. Convert it to PKCS#8 (BEGIN PRIVATE KEY) or a public key (BEGIN PUBLIC KEY): openssl pkcs8 -topk8 -nocrypt -in key.pem`) };
        return { error: t(`鍵を処理できませんでした: ${m}`, `Could not process the key: ${m}`) };
      }
    },
  },

  "ssh-key-inspector": {
    inputs: [{ id: "keys", label: ["SSH公開鍵（authorized_keys形式、1行1鍵）", "SSH public keys (authorized_keys format, one per line)"], rows: 6 }],
    sample: { keys: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMN6DOy78vemTqvts6cXx90mAIrQ9efWuTimou5jXCmC test@example" },
    run: async ({ inputs, t }) => {
      const rows: (string | number)[][] = [];
      const notes: string[] = [];
      for (const line of inputs.keys.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))) {
        try {
          const k = await inspectSshKey(line);
          rows.push([k.type, k.bits ?? "?", k.sha256, k.md5, k.comment, k.details.map(([a, b]) => `${a}=${b}`).join(", ")]);
          if (k.type === "ssh-dss") notes.push(t(`${k.comment || k.sha256}: DSA鍵は廃止されています。`, `${k.comment || k.sha256}: DSA keys are deprecated.`));
          if (k.type === "ssh-rsa" && (k.bits ?? 0) < 2048) notes.push(t(`${k.comment || k.sha256}: RSA ${k.bits}ビットは短すぎます（2048ビット以上を推奨）。`, `${k.comment || k.sha256}: RSA ${k.bits}-bit is too short (2048 or more recommended).`));
        } catch { rows.push(["?", "", "", "", line.slice(0, 40), t("SSH公開鍵として解析できません", "Cannot parse as an SSH public key")]); }
      }
      return { notes, tables: [{ head: [t("種類", "Type"), t("ビット", "Bits"), "SHA256", "MD5", t("コメント", "Comment"), t("詳細", "Details")], rows }] };
    },
  },

  "csr-decoder": {
    inputs: [{ id: "pem", label: ["CSR（-----BEGIN CERTIFICATE REQUEST-----）", "CSR (-----BEGIN CERTIFICATE REQUEST-----)"], rows: 10 }],
    files: { accept: ".csr,.pem,.req", label: [".csr / .pem ファイルをドロップ（任意）", "Drop a .csr / .pem file (optional)"] },
    run: ({ inputs, files, t }) => {
      try {
        const text = files[0] ? new TextDecoder().decode(files[0].bytes) : inputs.pem;
        const c = parseCsrPem(text);
        const notes: string[] = [];
        if (c.publicKey.algorithm.includes("RSA") && (c.publicKey.size ?? 0) < 2048) notes.push(t(`RSA ${c.publicKey.size}ビットは短すぎます（2048ビット以上を推奨）。`, `RSA ${c.publicKey.size}-bit is too short (2048 or more recommended).`));
        if (/sha1|md5/i.test(c.signatureAlgorithm)) notes.push(t(`署名アルゴリズム ${c.signatureAlgorithm} は弱く、多くのCAで受け付けられません。`, `The signature algorithm ${c.signatureAlgorithm} is weak and rejected by most CAs.`));
        if (!c.subjectAltNames.length) notes.push(t("SAN（Subject Alternative Name）がありません。現在のブラウザはSANがないとCNを使いません。", "There is no SAN (Subject Alternative Name). Current browsers ignore CN when SAN is absent."));
        return {
          notes: [...notes, t("CSR自体の署名（鍵の所有証明）の検証は行いません。", "The CSR's own signature (proof of possession) is not verified.")],
          tables: [{ head: [t("項目", "Field"), t("値", "Value")], rows: [["Subject", c.subject.map((s) => `${s.type}=${s.value}`).join(", ")], [t("公開鍵", "Public key"), `${c.publicKey.algorithm}${c.publicKey.size ? ` ${c.publicKey.size}` : ""}${c.publicKey.curve ? ` (${c.publicKey.curve})` : ""}`], [t("署名アルゴリズム", "Signature algorithm"), c.signatureAlgorithm], ["SAN", c.subjectAltNames.map((s) => `${s.type}:${s.value}`).join("\n") || "-"], [t("要求された拡張", "Requested extensions"), c.requestedExtensions.join(", ") || "-"]] }],
        };
      } catch { return { error: t("CSR（PEM）として解析できません。", "Could not parse as a CSR (PEM).") }; }
    },
  },

  "totp-generator": {
    inputs: [{ id: "secret", label: ["otpauth:// URI または Base32 シークレット", "otpauth:// URI or Base32 secret"], rows: 3 }],
    options: [{ id: "around", kind: "number", label: ["前後に表示するコードの数", "Codes to show before and after"], default: 1, min: 0, max: 5 }],
    manual: ["現在のコードを計算", "Calculate current code"],
    safetyNote: ["シークレットはこのブラウザ内だけで使われ、送信・保存されません。本番アカウントのシークレットの入力は避けてください。", "The secret is used only in this browser and never sent or stored. Avoid entering secrets of real accounts."],
    sample: { secret: "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example" },
    run: async ({ inputs, opts, t }) => {
      const p = parseOtpauth(inputs.secret);
      if (!p) return { error: t("Base32のシークレット、または otpauth:// URI として解析できません。", "Could not parse as a Base32 secret or otpauth:// URI.") };
      if (p.type === "hotp") return { error: t("HOTP（カウンター方式）は未対応です。TOTPのURIを入力してください。", "HOTP (counter-based) is not supported. Enter a TOTP URI.") };
      const now = Date.now();
      const { windows, remaining } = await totpWindows(p, now, Math.max(0, Math.min(5, Number(opts.around) || 0)));
      const time = (ms: number) => new Date(ms).toISOString().slice(11, 19) + "Z";
      return {
        notes: [t(`${p.algo} / ${p.digits}桁 / ${p.period}秒${p.issuer ? ` / 発行元: ${p.issuer}` : ""}`, `${p.algo} / ${p.digits} digits / ${p.period} s${p.issuer ? ` / issuer: ${p.issuer}` : ""}`), t(`現在のコードは あと ${remaining} 秒有効です。時計のずれがある場合は前後のコードで確認できます。`, `The current code is valid for ${remaining} more seconds. Nearby codes help diagnose clock skew.`)],
        tables: [{ head: [t("位置", "Offset"), t("コード", "Code"), t("有効期間 (UTC)", "Valid (UTC)")], rows: windows.map((w) => [w.offset === 0 ? t("現在", "current") : w.offset, w.code, `${time(w.validFrom)} – ${time(w.validUntil)}`]) }],
      };
    },
  },

  "text-encryptor": {
    inputs: [{ id: "text", label: ["平文（暗号化）／ 暗号文（復号）", "Plaintext (encrypt) / ciphertext (decrypt)"], rows: 8 }],
    options: [
      { id: "mode", kind: "select", label: ["操作", "Action"], default: "encrypt", choices: [{ value: "encrypt", label: ["暗号化", "Encrypt"] }, { value: "decrypt", label: ["復号", "Decrypt"] }] },
      { id: "pass", kind: "text", label: ["パスフレーズ", "Passphrase"], default: "", secret: true },
    ],
    manual: ["実行", "Run"],
    safetyNote: ["テキストとパスフレーズはこのブラウザ内（Web Crypto API）だけで処理されます。パスフレーズを忘れると復号できません。", "Text and passphrase are processed only in this browser (Web Crypto API). If you forget the passphrase, the data cannot be recovered."],
    run: async ({ inputs, opts, t }) => {
      const pass = String(opts.pass);
      if (!pass) return { error: t("パスフレーズを入力してください。", "Enter a passphrase.") };
      try {
        if (opts.mode === "encrypt") return { notes: [t("形式: CK1.<Base64URL>（PBKDF2-SHA256 60万回 + AES-256-GCM）", "Format: CK1.<Base64URL> (PBKDF2-SHA256 600,000 iterations + AES-256-GCM)")], text: await encryptText(inputs.text, pass) };
        return { text: await decryptText(inputs.text, pass) };
      } catch (e) {
        return { error: (e as Error).message === "wrong-passphrase" ? t("復号できません。パスフレーズが違うか、データが改ざん・破損しています。", "Cannot decrypt. The passphrase is wrong, or the data was tampered with or corrupted.") : t("このツールの形式（CK1.で始まる文字列）ではありません。", "This is not the tool's format (a string starting with CK1.).") };
      }
    },
  },

  "id-inspector": {
    inputs: [{ id: "ids", label: ["ID（1行1件）: UUID / ULID / Snowflake / MongoDB ObjectId", "IDs (one per line): UUID / ULID / Snowflake / MongoDB ObjectId"], rows: 6 }],
    options: [{ id: "epoch", kind: "text", label: ["Snowflakeの独自エポック（ミリ秒、任意）", "Custom Snowflake epoch (ms, optional)"], default: "" }],
    sample: { ids: "017f22e2-79b0-7cc3-98c4-dc0c0c07398f\n01ARZ3NDEKTSV4RRFFQ69G5FAV\n507f1f77bcf86cd799439011\n175928847299117063" },
    run: ({ inputs, opts, t }) => {
      const epoch = /^\d+$/.test(String(opts.epoch).trim()) ? BigInt(String(opts.epoch).trim()) : undefined;
      const rows: (string | number)[][] = [];
      for (const id of inputs.ids.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        const infos = inspectId(id, epoch);
        if (!infos.length) rows.push([id, "?", "-", t("認識できない形式です", "Unrecognized format")]);
        for (const info of infos) for (const [k, v] of info.details) rows.push([id, info.type, k, v]);
      }
      return { notes: [t("Snowflake系は桁数だけでは判定できないため、Twitter(X)とDiscordの2つのエポックで解釈した結果を並べています。", "Snowflake-style IDs cannot be identified by length alone, so results for both the Twitter (X) and Discord epochs are shown.")], tables: [{ head: ["ID", t("種類", "Type"), t("項目", "Field"), t("値", "Value")], rows }] };
    },
  },

  "checkdigit-validator": {
    inputs: [{ id: "nums", label: ["番号（1行1件、ハイフン・空白は無視）", "Numbers (one per line; hyphens and spaces are ignored)"], rows: 6 }],
    options: [
      { id: "type", kind: "select", label: ["種類", "Type"], default: "luhn", choices: [{ value: "luhn", label: ["Luhn（クレジットカードなど）", "Luhn (credit cards etc.)"] }, { value: "ean13", label: ["JAN/EAN-13", "JAN/EAN-13"] }, { value: "ean8", label: ["JAN/EAN-8", "JAN/EAN-8"] }, { value: "isbn13", label: "ISBN-13" }, { value: "isbn10", label: "ISBN-10" }, { value: "houjin", label: ["法人番号（13桁）", "Japanese corporate number (13 digits)"] }, { value: "mynumber", label: ["個人番号（12桁）", "Japanese My Number (12 digits)"] }, { value: "imei", label: "IMEI" }] },
      { id: "mode", kind: "select", label: ["操作", "Action"], default: "validate", choices: [{ value: "validate", label: ["検証", "Validate"] }, { value: "compute", label: ["チェックディジットを計算（本体のみ入力）", "Compute check digit (enter the body only)"] }] },
    ],
    sample: { nums: "4539 5787 6362 1486\n4539578763621487" },
    safetyNote: ["番号はこのブラウザ内だけで検証されます。本物のカード番号・個人番号の入力は避け、テスト番号を使ってください。", "Numbers are checked only in this browser. Avoid entering real card or personal numbers; use test numbers."],
    run: ({ inputs, opts, t }) => {
      const type = opts.type as CheckType;
      const rows = inputs.nums.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
        if (opts.mode === "compute") {
          const d = computeCheckDigit(type, line);
          return [line, d === null ? t("本体の桁数・形式が不正です", "Invalid body length or format") : `${type === "houjin" ? d + line.replace(/[\s-]/g, "") : line.replace(/[\s-]/g, "") + d}`, d ?? ""];
        }
        const r = validateCheckDigit(type, line);
        const why = r.valid ? t("✔ 正しい", "✔ valid") : r.reason === "length" ? t("✖ 桁数が違います", "✖ wrong length") : r.reason === "format" ? t("✖ 使えない文字を含みます", "✖ contains invalid characters") : t(`✖ チェックディジット不一致（正しくは ${r.expected}）`, `✖ check digit mismatch (expected ${r.expected})`);
        return [line, why, r.brand ?? ""];
      });
      return { tables: [{ head: [t("入力", "Input"), opts.mode === "compute" ? t("完全な番号", "Full number") : t("結果", "Result"), opts.mode === "compute" ? t("チェックディジット", "Check digit") : t("ブランド", "Brand")], rows }] };
    },
  },

  "iam-policy-explainer": {
    inputs: [{ id: "json", label: ["IAMポリシー（JSON）", "IAM policy (JSON)"], rows: 12 }],
    sample: { json: '{\n  "Version": "2012-10-17",\n  "Statement": [\n    { "Sid": "ReadBucket", "Effect": "Allow", "Action": ["s3:GetObject"], "Resource": "arn:aws:s3:::my-bucket/*" },\n    { "Sid": "TooBroad", "Effect": "Allow", "Action": "iam:*", "Resource": "*" }\n  ]\n}' },
    run: ({ inputs, t }) => {
      try {
        const r = explainIamPolicy(inputs.json, t);
        return { notes: [countNote(t, r.findings)], text: r.statements.map((s, i) => `${i + 1}. ${s}`).join("\n"), tables: [findingsTable(r.findings, (f) => f.sid, [t("レベル", "Level"), "Statement", t("内容", "Message")])] };
      } catch (e) {
        return { error: (e as Error).message === "no-statement" ? t("Statement がありません。", "There is no Statement.") : t("JSONとして解析できません。", "Could not parse as JSON.") };
      }
    },
    outputLabel: ["ポリシーの内容（平易な説明）", "Policy in plain words"],
  },
};
