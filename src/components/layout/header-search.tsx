"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchTools } from "@/config/tools";
import { cn } from "@/lib/utils";

export function HeaderSearch() {
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = query.trim() ? searchTools(query).slice(0, 8) : [];
  const showDropdown = focused && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="ツールを検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          className="pl-8 pr-8"
          aria-label="ツールを検索"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="検索をクリア"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className={cn(
            "absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          )}
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              一致するツールが見つかりません
            </p>
          ) : (
            results.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  href={tool.path}
                  onClick={() => {
                    setQuery("");
                    setFocused(false);
                  }}
                  className="flex items-start gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <span className="flex flex-col">
                    <span className="font-medium">{tool.name}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {tool.description}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
