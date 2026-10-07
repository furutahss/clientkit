import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      // mermaid の ELK レイアウトが使う elkjs（EPL-2.0）を配信物に含めない
      "elkjs/lib/elk.bundled.js": "./src/lib/elk-stub.ts",
    },
  },
};

export default nextConfig;
