/**
 * X.509証明書（PEM / DER）の解析。
 * ASN.1 DERを直接読み取り、発行者・サブジェクト・有効期限・SANなどを取り出す。
 */

type Asn1Node = {
  tagClass: number;
  constructed: boolean;
  tagNumber: number;
  /** ヘッダーを含むノード全体の開始位置 */
  start: number;
  /** 値部分の開始位置 */
  contentStart: number;
  end: number;
  children: Asn1Node[];
};

export class CertificateParseError extends Error {}

function readNode(bytes: Uint8Array, offset: number, depth = 0): Asn1Node {
  if (depth > 64) throw new CertificateParseError("too deep");
  if (offset + 2 > bytes.length) throw new CertificateParseError("unexpected end");
  const first = bytes[offset];
  const tagClass = first >> 6;
  const constructed = (first & 0x20) !== 0;
  let tagNumber = first & 0x1f;
  let position = offset + 1;
  if (tagNumber === 0x1f) {
    tagNumber = 0;
    while (position < bytes.length) {
      const byte = bytes[position++];
      tagNumber = (tagNumber << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
  }

  let length = bytes[position++];
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4) throw new CertificateParseError("unsupported length");
    length = 0;
    for (let i = 0; i < count; i += 1) length = length * 256 + bytes[position++];
  }
  const contentStart = position;
  const end = contentStart + length;
  if (end > bytes.length) throw new CertificateParseError("length exceeds data");

  const children: Asn1Node[] = [];
  if (constructed) {
    let childOffset = contentStart;
    while (childOffset < end) {
      const child = readNode(bytes, childOffset, depth + 1);
      children.push(child);
      childOffset = child.end;
    }
  }
  return { tagClass, constructed, tagNumber, start: offset, contentStart, end, children };
}

function content(bytes: Uint8Array, node: Asn1Node): Uint8Array {
  return bytes.subarray(node.contentStart, node.end);
}

function toHex(bytes: Uint8Array, separator = ""): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(separator);
}

function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const parts: number[] = [];
  const first = bytes[0];
  parts.push(first < 80 ? Math.floor(first / 40) : 2, first < 80 ? first % 40 : first - 80);
  let value = 0;
  for (let i = 1; i < bytes.length; i += 1) {
    value = value * 128 + (bytes[i] & 0x7f);
    if ((bytes[i] & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

function decodeString(bytes: Uint8Array, node: Asn1Node): string {
  const data = content(bytes, node);
  switch (node.tagNumber) {
    case 0x1e: {
      // BMPString（UTF-16BE）
      let text = "";
      for (let i = 0; i + 1 < data.length; i += 2) text += String.fromCharCode((data[i] << 8) | data[i + 1]);
      return text;
    }
    case 0x1c: {
      // UniversalString（UTF-32BE）
      let text = "";
      for (let i = 0; i + 3 < data.length; i += 4) {
        text += String.fromCodePoint(((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0);
      }
      return text;
    }
    case 0x0c:
      return new TextDecoder("utf-8").decode(data);
    default:
      return new TextDecoder("latin1").decode(data);
  }
}

function decodeTime(bytes: Uint8Array, node: Asn1Node): Date {
  const text = new TextDecoder("latin1").decode(content(bytes, node));
  const match =
    node.tagNumber === 0x17
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(text)
      : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?Z$/.exec(text);
  if (!match) throw new CertificateParseError("invalid time");
  let year = Number(match[1]);
  // UTCTimeは50以上を19xx年、50未満を20xx年とみなす（RFC 5280）
  if (node.tagNumber === 0x17) year += year >= 50 ? 1900 : 2000;
  return new Date(
    Date.UTC(year, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? 0))
  );
}

const OID_NAMES: Record<string, string> = {
  // 識別名の属性
  "2.5.4.3": "CN",
  "2.5.4.4": "SN",
  "2.5.4.5": "serialNumber",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.9": "street",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.12": "title",
  "2.5.4.15": "businessCategory",
  "2.5.4.17": "postalCode",
  "2.5.4.42": "GN",
  "1.2.840.113549.1.9.1": "emailAddress",
  "0.9.2342.19200300.100.1.25": "DC",
  "0.9.2342.19200300.100.1.1": "UID",
  "1.3.6.1.4.1.311.60.2.1.3": "jurisdictionC",
  // 署名アルゴリズム
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.113549.1.1.10": "RSASSA-PSS",
  "1.2.840.10045.4.1": "ecdsa-with-SHA1",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",
  // 公開鍵アルゴリズム
  "1.2.840.113549.1.1.1": "RSA",
  "1.2.840.10045.2.1": "EC",
  // 楕円曲線
  "1.2.840.10045.3.1.7": "P-256 (prime256v1)",
  "1.3.132.0.34": "P-384 (secp384r1)",
  "1.3.132.0.35": "P-521 (secp521r1)",
  "1.3.132.0.10": "secp256k1",
  // 拡張キー使用法
  "1.3.6.1.5.5.7.3.1": "serverAuth",
  "1.3.6.1.5.5.7.3.2": "clientAuth",
  "1.3.6.1.5.5.7.3.3": "codeSigning",
  "1.3.6.1.5.5.7.3.4": "emailProtection",
  "1.3.6.1.5.5.7.3.8": "timeStamping",
  "1.3.6.1.5.5.7.3.9": "OCSPSigning",
  "2.5.29.37.0": "anyExtendedKeyUsage",
  // 拡張
  "2.5.29.14": "subjectKeyIdentifier",
  "2.5.29.15": "keyUsage",
  "2.5.29.17": "subjectAltName",
  "2.5.29.19": "basicConstraints",
  "2.5.29.31": "cRLDistributionPoints",
  "2.5.29.32": "certificatePolicies",
  "2.5.29.35": "authorityKeyIdentifier",
  "2.5.29.37": "extKeyUsage",
  "1.3.6.1.5.5.7.1.1": "authorityInfoAccess",
  "1.3.6.1.4.1.11129.2.4.2": "signedCertificateTimestampList",
};

export function oidName(oid: string): string {
  return OID_NAMES[oid] ?? oid;
}

const KEY_USAGE_NAMES = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "cRLSign",
  "encipherOnly",
  "decipherOnly",
];

export type DistinguishedNameEntry = { type: string; value: string };

export type SubjectAltName = { type: "DNS" | "IP" | "email" | "URI" | "other"; value: string };

export type CertificateExtension = { oid: string; name: string; critical: boolean };

export type ParsedCertificate = {
  der: Uint8Array;
  version: number;
  serialNumber: string;
  signatureAlgorithm: string;
  issuer: DistinguishedNameEntry[];
  subject: DistinguishedNameEntry[];
  notBefore: Date;
  notAfter: Date;
  publicKey: { algorithm: string; size: number | null; curve: string | null };
  subjectAltNames: SubjectAltName[];
  isCa: boolean | null;
  pathLength: number | null;
  keyUsage: string[];
  extendedKeyUsage: string[];
  subjectKeyId: string | null;
  authorityKeyId: string | null;
  extensions: CertificateExtension[];
  selfIssued: boolean;
};

function parseName(bytes: Uint8Array, node: Asn1Node): DistinguishedNameEntry[] {
  const entries: DistinguishedNameEntry[] = [];
  for (const rdn of node.children) {
    for (const attribute of rdn.children) {
      const [oidNode, valueNode] = attribute.children;
      if (!oidNode || !valueNode) continue;
      entries.push({
        type: oidName(decodeOid(content(bytes, oidNode))),
        value: decodeString(bytes, valueNode),
      });
    }
  }
  return entries;
}

export function formatDistinguishedName(entries: DistinguishedNameEntry[]): string {
  return entries.map((entry) => `${entry.type}=${entry.value}`).join(", ");
}

function formatIp(data: Uint8Array): string {
  if (data.length === 4) return Array.from(data).join(".");
  if (data.length === 16) {
    const groups: string[] = [];
    for (let i = 0; i < 16; i += 2) groups.push(((data[i] << 8) | data[i + 1]).toString(16));
    return groups.join(":").replace(/(^|:)0(:0)+(:|$)/, "::");
  }
  return toHex(data, ":");
}

function bitLength(integer: Uint8Array): number {
  let start = 0;
  while (start < integer.length && integer[start] === 0) start += 1;
  if (start >= integer.length) return 0;
  return (integer.length - start - 1) * 8 + (32 - Math.clz32(integer[start]));
}

function parsePublicKey(bytes: Uint8Array, node: Asn1Node): ParsedCertificate["publicKey"] {
  const [algorithmNode, keyNode] = node.children;
  const oid = decodeOid(content(bytes, algorithmNode.children[0]));
  const algorithm = oidName(oid);
  if (oid === "1.2.840.113549.1.1.1" && keyNode) {
    // BIT STRING の先頭1バイトは未使用ビット数
    const keyBytes = content(bytes, keyNode).subarray(1);
    const rsaKey = readNode(keyBytes, 0);
    const modulus = content(keyBytes, rsaKey.children[0]);
    return { algorithm, size: bitLength(modulus), curve: null };
  }
  if (oid === "1.2.840.10045.2.1") {
    const curveNode = algorithmNode.children[1];
    const curve = curveNode ? oidName(decodeOid(content(bytes, curveNode))) : null;
    const size = curve?.startsWith("P-") ? Number(curve.slice(2, 5)) : curve === "secp256k1" ? 256 : null;
    return { algorithm, size, curve };
  }
  if (oid === "1.3.101.112") return { algorithm, size: 256, curve: null };
  if (oid === "1.3.101.113") return { algorithm, size: 456, curve: null };
  return { algorithm, size: null, curve: null };
}

export function parseCertificateDer(der: Uint8Array): ParsedCertificate {
  const root = readNode(der, 0);
  if (root.end !== der.length && der.length - root.end > 2) {
    throw new CertificateParseError("trailing data");
  }
  const [tbs, signatureAlgorithmNode] = root.children;
  if (!tbs || !signatureAlgorithmNode || tbs.children.length < 6) {
    throw new CertificateParseError("not a certificate");
  }

  let index = 0;
  let version = 1;
  if (tbs.children[0].tagClass === 2 && tbs.children[0].tagNumber === 0) {
    version = content(der, tbs.children[0].children[0])[0] + 1;
    index = 1;
  }
  const serialNode = tbs.children[index];
  const issuerNode = tbs.children[index + 2];
  const validityNode = tbs.children[index + 3];
  const subjectNode = tbs.children[index + 4];
  const publicKeyNode = tbs.children[index + 5];

  let serial = content(der, serialNode);
  if (serial.length > 1 && serial[0] === 0) serial = serial.subarray(1);

  const certificate: ParsedCertificate = {
    der,
    version,
    serialNumber: toHex(serial, ":"),
    signatureAlgorithm: oidName(decodeOid(content(der, signatureAlgorithmNode.children[0]))),
    issuer: parseName(der, issuerNode),
    subject: parseName(der, subjectNode),
    notBefore: decodeTime(der, validityNode.children[0]),
    notAfter: decodeTime(der, validityNode.children[1]),
    publicKey: parsePublicKey(der, publicKeyNode),
    subjectAltNames: [],
    isCa: null,
    pathLength: null,
    keyUsage: [],
    extendedKeyUsage: [],
    subjectKeyId: null,
    authorityKeyId: null,
    extensions: [],
    selfIssued: false,
  };
  certificate.selfIssued =
    formatDistinguishedName(certificate.issuer) === formatDistinguishedName(certificate.subject);

  const extensionsWrapper = tbs.children.find(
    (child) => child.tagClass === 2 && child.tagNumber === 3
  );
  const extensionList = extensionsWrapper?.children[0]?.children ?? [];
  for (const extension of extensionList) {
    const oid = decodeOid(content(der, extension.children[0]));
    const critical =
      extension.children.length === 3 && content(der, extension.children[1])[0] === 0xff;
    const valueNode = extension.children[extension.children.length - 1];
    certificate.extensions.push({ oid, name: oidName(oid), critical });

    let value: Asn1Node;
    try {
      value = readNode(content(der, valueNode), 0);
    } catch {
      continue;
    }
    const valueBytes = content(der, valueNode);

    try {
      switch (oid) {
        case "2.5.29.17":
          for (const name of value.children) {
            const data = content(valueBytes, name);
            if (name.tagNumber === 2) certificate.subjectAltNames.push({ type: "DNS", value: new TextDecoder("latin1").decode(data) });
            else if (name.tagNumber === 7) certificate.subjectAltNames.push({ type: "IP", value: formatIp(data) });
            else if (name.tagNumber === 1) certificate.subjectAltNames.push({ type: "email", value: new TextDecoder("latin1").decode(data) });
            else if (name.tagNumber === 6) certificate.subjectAltNames.push({ type: "URI", value: new TextDecoder("latin1").decode(data) });
            else certificate.subjectAltNames.push({ type: "other", value: `[${name.tagNumber}]` });
          }
          break;
        case "2.5.29.19": {
          const [first, second] = value.children;
          certificate.isCa = first?.tagNumber === 1 ? content(valueBytes, first)[0] === 0xff : false;
          const lengthNode = first?.tagNumber === 2 ? first : second;
          if (lengthNode?.tagNumber === 2) {
            certificate.pathLength = content(valueBytes, lengthNode).reduce((acc, byte) => acc * 256 + byte, 0);
          }
          break;
        }
        case "2.5.29.15": {
          const data = content(valueBytes, value);
          const unused = data[0];
          const totalBits = (data.length - 1) * 8 - unused;
          for (let bit = 0; bit < totalBits && bit < KEY_USAGE_NAMES.length; bit += 1) {
            if (data[1 + Math.floor(bit / 8)] & (0x80 >> bit % 8)) certificate.keyUsage.push(KEY_USAGE_NAMES[bit]);
          }
          break;
        }
        case "2.5.29.37":
          certificate.extendedKeyUsage = value.children.map((child) => oidName(decodeOid(content(valueBytes, child))));
          break;
        case "2.5.29.14":
          certificate.subjectKeyId = toHex(content(valueBytes, value), ":");
          break;
        case "2.5.29.35": {
          const keyId = value.children.find((child) => child.tagClass === 2 && child.tagNumber === 0);
          if (keyId) certificate.authorityKeyId = toHex(content(valueBytes, keyId), ":");
          break;
        }
      }
    } catch {
      // 拡張の解析に失敗しても証明書全体の表示は続ける
    }
  }

  return certificate;
}

export type CertificateInputResult = {
  certificates: ParsedCertificate[];
  errors: number;
};

const PEM_PATTERN = /-----BEGIN (?:X509 |TRUSTED )?CERTIFICATE-----([\s\S]*?)-----END (?:X509 |TRUSTED )?CERTIFICATE-----/g;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/[^A-Za-z0-9+/=]/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** PEMテキスト（複数の証明書を含むチェーンも可）から証明書を取り出して解析する */
export function parseCertificatesFromText(text: string): CertificateInputResult {
  const certificates: ParsedCertificate[] = [];
  let errors = 0;
  const blocks = Array.from(text.matchAll(PEM_PATTERN));

  if (blocks.length === 0) {
    // ヘッダーなしのBase64（DERをエンコードしたもの）も受け付ける
    const compact = text.replace(/\s+/g, "");
    if (compact && /^[A-Za-z0-9+/]+=*$/.test(compact)) {
      try {
        certificates.push(parseCertificateDer(base64ToBytes(compact)));
      } catch {
        errors += 1;
      }
    }
    return { certificates, errors };
  }

  for (const block of blocks) {
    try {
      certificates.push(parseCertificateDer(base64ToBytes(block[1])));
    } catch {
      errors += 1;
    }
  }
  return { certificates, errors };
}

/** バイナリファイル（DER）かPEMかを判定して解析する */
export function parseCertificatesFromBytes(bytes: Uint8Array): CertificateInputResult {
  if (bytes[0] === 0x30) {
    try {
      return { certificates: [parseCertificateDer(bytes)], errors: 0 };
    } catch {
      // PEMとして解釈を試みる
    }
  }
  return parseCertificatesFromText(new TextDecoder("utf-8").decode(bytes));
}

export async function fingerprint(der: Uint8Array, algorithm: "SHA-256" | "SHA-1"): Promise<string> {
  const digest = await crypto.subtle.digest(algorithm, der as Uint8Array<ArrayBuffer>);
  return toHex(new Uint8Array(digest), ":");
}

export type ValidityStatus = "valid" | "expiring" | "expired" | "not-yet-valid";

/** 期限切れまでの残り日数がこれ以下の場合は「まもなく期限切れ」とする */
export const EXPIRING_SOON_DAYS = 30;

export function getValidityStatus(certificate: ParsedCertificate, now: number): {
  status: ValidityStatus;
  days: number;
} {
  const dayMs = 86_400_000;
  if (now < certificate.notBefore.getTime()) {
    return { status: "not-yet-valid", days: Math.ceil((certificate.notBefore.getTime() - now) / dayMs) };
  }
  const remaining = certificate.notAfter.getTime() - now;
  if (remaining < 0) return { status: "expired", days: Math.floor(-remaining / dayMs) };
  const days = Math.floor(remaining / dayMs);
  return { status: days <= EXPIRING_SOON_DAYS ? "expiring" : "valid", days };
}
