import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryById, type Tool } from "@/config/tools";

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  const category = getCategoryById(tool.category);

  return (
    <Link href={tool.path} className="group block h-full">
      <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-base">{tool.name}</CardTitle>
              {category && (
                <span className="text-xs text-muted-foreground">
                  {category.label}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{tool.description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
