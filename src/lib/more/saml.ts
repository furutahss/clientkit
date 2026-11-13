import { inflateSync } from "fflate";

import { base64ToBytes, fromUtf8 } from "./util";
import { formatXml } from "./xml";

/** SAMLRequest / SAMLResponse（Base64、URLエンコード、Redirect bindingのdeflate）をXMLにする */
export function decodeSaml(input: string): { xml: string; deflated: boolean } {
  let s = input.trim();
  const param = /(?:^|[?&])SAML(?:Request|Response)=([^&\s]+)/.exec(s);
  if (param) s = param[1];
  if (s.includes("%")) { try { s = decodeURIComponent(s); } catch { /* 既にデコード済み */ } }
  const bytes = base64ToBytes(s);
  if (!bytes) throw new Error("not-base64");
  const plain = fromUtf8(bytes);
  if (plain.trimStart().startsWith("<")) return { xml: plain, deflated: false };
  try {
    const xml = fromUtf8(inflateSync(bytes));
    if (xml.trimStart().startsWith("<")) return { xml, deflated: true };
  } catch { /* 下で失敗扱い */ }
  throw new Error("not-xml");
}

export type SamlSummary = { label: string; value: string }[];
export function summarizeSaml(xml: string): SamlSummary {
  const out: SamlSummary = [];
  const first = (re: RegExp) => re.exec(xml)?.[1];
  const add = (label: string, v: string | undefined) => { if (v) out.push({ label, value: v.trim() }); };
  add("Type", first(/<(?:\w+:)?(AuthnRequest|Response|LogoutRequest|LogoutResponse)\b/));
  add("Destination", first(/\bDestination="([^"]*)"/));
  add("InResponseTo", first(/\bInResponseTo="([^"]*)"/));
  add("IssueInstant", first(/\bIssueInstant="([^"]*)"/));
  add("Issuer", first(/<(?:\w+:)?Issuer[^>]*>([^<]*)</));
  add("Status", first(/<(?:\w+:)?StatusCode\b[^>]*Value="([^"]*)"/));
  add("NameID", first(/<(?:\w+:)?NameID[^>]*>([^<]*)</));
  add("NotBefore", first(/\bNotBefore="([^"]*)"/));
  add("NotOnOrAfter", first(/\bNotOnOrAfter="([^"]*)"/));
  add("Audience", first(/<(?:\w+:)?Audience>([^<]*)</));
  add("AuthnContext", first(/<(?:\w+:)?AuthnContextClassRef>([^<]*)</));
  add("SignatureMethod", first(/<(?:\w+:)?SignatureMethod\b[^>]*Algorithm="([^"]*)"/));
  add("Signature", /<(?:\w+:)?Signature\b/.test(xml) ? "present (not verified)" : "absent");
  if (/<(?:\w+:)?EncryptedAssertion\b/.test(xml)) add("Assertion", "encrypted (cannot be shown)");
  for (const m of xml.matchAll(/<(?:\w+:)?Attribute\b[^>]*\bName="([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?Attribute>/g)) {
    const values = [...m[2].matchAll(/<(?:\w+:)?AttributeValue[^>]*>([^<]*)</g)].map((v) => v[1]);
    out.push({ label: `Attribute ${m[1]}`, value: values.join(", ") });
  }
  return out;
}

export const prettySaml = (xml: string) => { try { return formatXml(xml); } catch { return xml; } };
