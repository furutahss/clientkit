import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryById, getToolPath, type Tool } from "@/config/tools";
import type { Locale } from "@/i18n/config";

export function ToolCard({ tool, lang }: { tool: Tool; lang: Locale }) {
  const Icon = tool.icon;
  const category = getCategoryById(tool.category);

  return (
    <Link href={getToolPath(lang, tool.id)} className="group block h-full">
      <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-base">{tool.name[lang]}</CardTitle>
              {category && (
                <span className="text-xs text-muted-foreground">
                  {category.label[lang]}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {tool.description[lang]}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
