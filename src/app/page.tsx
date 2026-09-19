import { ToolExplorer } from "@/components/home/tool-explorer";
import { siteConfig } from "@/config/site";

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

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">ツール一覧</h2>
        <ToolExplorer />
      </section>
    </div>
  );
}
