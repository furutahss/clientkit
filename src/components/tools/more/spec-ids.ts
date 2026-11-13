/** 追加ツールのID一覧。設定（ToolSpec）で動くツールはグループごとの specs/*.ts と対応し、専用UIのツールは custom に置く。 */
export const SPEC_IDS = {
  web: ["http-header-analyzer", "ogp-checker", "jsonld-validator", "sitemap-validator", "email-auth-checker", "email-header-analyzer", "ipv6-calculator", "access-log-analyzer", "saml-decoder", "sri-generator", "webhook-signature"],
  security: ["jwt-signer", "key-converter", "ssh-key-inspector", "csr-decoder", "totp-generator", "text-encryptor", "id-inspector", "checkdigit-validator", "iam-policy-explainer"],
  data: ["jq-playground", "json-repair", "json-to-types", "schema-sample-generator", "xml-tool", "msgpack-cbor-converter", "protobuf-decoder", "graphql-tool", "ndjson-viewer", "fake-data-generator", "markdown-table", "zip-viewer", "lockfile-diff", "package-json-checker"],
  text: ["encoding-converter", "escape-tool", "case-converter", "line-tools", "radix-calculator", "ieee754-viewer", "intl-playground"],
  code: ["css-specificity", "css-units", "css-visual-generator", "color-scale", "html-to-jsx", "glob-tester", "diff-viewer", "mysql-explain-viewer", "sql-schema-diff", "openapi-viewer", "terraform-plan-viewer", "k8s-manifest-checker", "docker-converter", "github-actions-viewer"],
  media: ["blurhash-generator", "srcset-generator", "og-image-generator", "barcode-tool", "font-inspector", "sourcemap-bundle-analyzer"],
} as const;

export const CUSTOM_IDS = ["keyboard-inspector", "folder-compare"] as const;
