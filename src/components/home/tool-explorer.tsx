"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Star, X } from "lucide-react";
import { SmartDrop } from "@/components/home/smart-drop";
import { ToolCard } from "@/components/home/tool-card";
import { ToolCategories } from "@/components/home/tool-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCategoryById,
  getToolById,
  getToolsByCategory,
  searchTools,
  tools,
  type Tool,
} from "@/config/tools";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { clearRecentTools, useToolPreferences } from "@/lib/tool-preferences";
import { formatTemplate } from "@/lib/utils";

export function ToolExplorer() {
  const locale = useLocale();
  const dict = getDictionary(locale).discovery;
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [previousUrlQuery, setPreviousUrlQuery] = useState(urlQuery);
  if (urlQuery !== previousUrlQuery) {
    setPreviousUrlQuery(urlQuery);
    setQuery(urlQuery);
  }
  const category = getCategoryById(params.get("category") ?? "");
  const view = params.get("view");
  const { favorites, recent } = useToolPreferences();
  const favoriteTools = favorites
    .map(getToolById)
    .filter((tool): tool is Tool => !!tool);
  const recentTools = recent
    .map(getToolById)
    .filter((tool): tool is Tool => !!tool);
  const searching = !!query.trim();
  const isHome =
    !searching &&
    !category &&
    !["all", "favorites", "recent"].includes(view ?? "");
  const results = searching
    ? searchTools(locale, query)
    : category
      ? getToolsByCategory(category.id)
      : view === "favorites"
        ? favoriteTools
        : view === "recent"
          ? recentTools
          : tools;
  const heading = searching
    ? formatTemplate(dict.searchResults, { query: query.trim() })
    : category
      ? category.label[locale]
      : view === "favorites"
        ? dict.favorites
        : view === "recent"
          ? dict.recent
          : dict.allTools;

  function updateQuery(value: string) {
    setQuery(value);
    const next = new URLSearchParams();
    if (value) next.set("q", value);
    window.history.replaceState(
      null,
      "",
      `/${locale}${next.size ? `?${next}` : ""}`,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder={dict.searchPlaceholder}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !event.nativeEvent.isComposing)
                updateQuery("");
            }}
            className="h-12 rounded-xl pr-12 pl-12 text-base"
            aria-label={dict.searchPlaceholder}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 size-10"
              onClick={() => updateQuery("")}
              aria-label={dict.clearQuery}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{dict.examplesLabel}</span>
          {dict.searchExamples.map((example) => (
            <button
              key={example}
              type="button"
              className="min-h-8 underline underline-offset-4 hover:text-foreground"
              onClick={() => updateQuery(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {isHome ? (
        <>
          <SmartDrop />
          {favoriteTools.length > 0 && (
            <section
              className="flex flex-col gap-3"
              aria-labelledby="favorites-heading"
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="favorites-heading"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Star className="size-4" aria-hidden="true" />
                  {dict.favorites}
                </h2>
                <Link
                  href={`/${locale}?view=favorites`}
                  className="text-sm underline underline-offset-4"
                >
                  {dict.viewAll}
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {favoriteTools.slice(0, 6).map((tool) => (
                  <ToolCard key={tool.id} tool={tool} lang={locale} />
                ))}
              </div>
            </section>
          )}
          <ToolCategories lang={locale} />
        </>
      ) : (
        <section
          className="flex flex-col gap-4"
          aria-labelledby="results-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="results-heading"
                className="break-all text-lg font-semibold"
              >
                {heading}
              </h2>
              <span
                role="status"
                className="text-sm tabular-nums text-muted-foreground"
              >
                {formatTemplate(dict.resultCount, { count: results.length })}
              </span>
            </div>
            <Link
              href={`/${locale}`}
              className="text-sm underline underline-offset-4"
            >
              {dict.back}
            </Link>
          </div>
          {!searching &&
            !category &&
            (view === "favorites" || view === "recent") && (
              <p className="text-xs text-muted-foreground">{dict.localNote}</p>
            )}
          {!searching &&
            !category &&
            view === "recent" &&
            recent.length > 0 && (
              <Button
                variant="outline"
                className="self-start"
                onClick={clearRecentTools}
              >
                {dict.clearRecent}
              </Button>
            )}
          {results.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((tool) => (
                <ToolCard key={tool.id} tool={tool} lang={locale} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              {searching
                ? dict.noResults
                : view === "favorites"
                  ? dict.emptyFavorites
                  : dict.emptyRecent}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
