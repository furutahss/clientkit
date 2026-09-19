"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { ToolCard } from "@/components/home/tool-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { categories, searchTools } from "@/config/tools";
import { cn } from "@/lib/utils";

export function ToolExplorer() {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string | null>(
    null
  );

  const filteredTools = React.useMemo(() => {
    const matched = searchTools(query);
    if (!activeCategory) return matched;
    return matched.filter((tool) => tool.category === activeCategory);
  }, [query, activeCategory]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="ツールを検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
            aria-label="ツールを検索"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeCategory === null ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => setActiveCategory(null)}
          >
            すべて
          </Badge>
          {categories.map((category) => (
            <Badge
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              className={cn("cursor-pointer select-none")}
              onClick={() =>
                setActiveCategory((prev) =>
                  prev === category.id ? null : category.id
                )
              }
            >
              {category.label}
            </Badge>
          ))}
        </div>
      </div>

      {filteredTools.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          条件に一致するツールが見つかりませんでした。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
