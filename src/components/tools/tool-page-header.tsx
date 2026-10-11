import { Breadcrumb } from "@/components/layout/breadcrumb";
import { FavoriteToolButton } from "@/components/tools/favorite-tool-button";
import { getCategoryById, type Tool } from "@/config/tools";
import type { Locale } from "@/i18n/config";

export function ToolPageHeader({ tool, lang }: { tool: Tool; lang: Locale }) {
  const category = getCategoryById(tool.category);

  return (
    <div className="flex flex-col gap-2">
      <Breadcrumb
        lang={lang}
        items={[
          ...(category ? [{ label: category.label[lang] }] : []),
          { label: tool.name[lang] },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{tool.name[lang]}</h1>
        <FavoriteToolButton id={tool.id} name={tool.name[lang]} lang={lang} />
      </div>
      <p className="text-muted-foreground">
        {tool.longDescription?.[lang] ?? tool.description[lang]}
      </p>
    </div>
  );
}
