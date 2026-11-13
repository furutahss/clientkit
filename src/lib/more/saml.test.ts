import { deflateSync } from "fflate";
import { describe, expect, it } from "vitest";

import { decodeSaml, summarizeSaml } from "./saml";
import { bytesToBase64, utf8 } from "./util";

const xml = `<samlp:Response xmlns:samlp="p" Destination="https://sp/acs" IssueInstant="2026-01-01T00:00:00Z"><saml:Issuer>https://idp</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status><saml:Assertion><saml:Subject><saml:NameID>alice@example.com</saml:NameID></saml:Subject><saml:Conditions NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="2026-01-01T00:05:00Z"><saml:AudienceRestriction><saml:Audience>https://sp</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AttributeStatement><saml:Attribute Name="role"><saml:AttributeValue>admin</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion></samlp:Response>`;

describe("SAMLデコード", () => {
  it("Base64とdeflate+Base64（URLエンコード付き）を復元する", () => {
    expect(decodeSaml(bytesToBase64(utf8(xml)))).toEqual({ xml, deflated: false });
    const q = `SAMLResponse=${encodeURIComponent(bytesToBase64(deflateSync(utf8(xml))))}&RelayState=x`;
    expect(decodeSaml(q)).toEqual({ xml, deflated: true });
    expect(() => decodeSaml("!!!")).toThrow("not-base64");
    expect(() => decodeSaml(bytesToBase64(utf8("plain text")))).toThrow("not-xml");
  });

  it("主要な項目を取り出す", () => {
    const s = Object.fromEntries(summarizeSaml(xml).map((x) => [x.label, x.value]));
    expect(s).toMatchObject({ Issuer: "https://idp", NameID: "alice@example.com", Audience: "https://sp", NotOnOrAfter: "2026-01-01T00:05:00Z", "Attribute role": "admin", Signature: "absent" });
  });
});
