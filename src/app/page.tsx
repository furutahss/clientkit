import { Lock, ShieldCheck, Zap } from "lucide-react";

import { ToolExplorer } from "@/components/home/tool-explorer";
import { siteConfig } from "@/config/site";

const features = [
  {
    icon: ShieldCheck,
    title: "安全",
    description:
      "入力したデータはサーバーへ一切送信されません。すべての処理はあなたのブラウザ内で完結します。",
  },
  {
    icon: Zap,
    title: "高速",
    description: "通信が発生しないため、ネットワーク環境に左右されず高速に動作します。",
  },
  {
    icon: Lock,
    title: "プライバシー保護",
    description: "機密情報や個人情報を扱う作業でも安心して利用できます。",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 py-6 text-center sm:py-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <p className="mx-auto max-w-2xl text-lg font-medium text-primary">
          {siteConfig.tagline}
        </p>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {siteConfig.description}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-2 rounded-xl border p-6 text-center"
            >
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">ツール一覧</h2>
        <ToolExplorer />
      </section>
    </div>
  );
}
