import Link from "next/link";
import { FavoriteToolButton } from "@/components/tools/favorite-tool-button";
import { Card } from "@/components/ui/card";
import { getCategoryById, getToolPath, type Tool } from "@/config/tools";
import type { Locale } from "@/i18n/config";

export function ToolCard({
  tool,
  lang,
  onSelect,
}: {
  tool: Tool;
  lang: Locale;
  /** スマートドロップでのファイル引き継ぎを、遷移前に行う。 */
  onSelect?: () => void;
}) {
  const Icon = tool.icon;
  const category = getCategoryById(tool.category);
  return (
    <Card className="relative h-full gap-0 p-0 shadow-none transition-colors hover:border-primary/40 hover:bg-accent/40">
      <Link
        href={getToolPath(lang, tool.id)}
        onClick={onSelect}
        className="flex h-full flex-col gap-3 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <div className="flex items-start gap-2.5 pr-9">
          <Icon
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm leading-relaxed font-semibold">
              {tool.name[lang]}
            </h3>
            {category && (
              <span className="text-xs text-muted-foreground">
                {category.label[lang]}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {tool.description[lang]}
        </p>
      </Link>
      <div className="absolute top-1.5 right-1.5">
        <FavoriteToolButton id={tool.id} name={tool.name[lang]} lang={lang} />
      </div>
    </Card>
  );
}
