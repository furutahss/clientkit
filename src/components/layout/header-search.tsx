"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getToolById,
  getToolPath,
  searchTools,
  tools,
  type Tool,
} from "@/config/tools";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { useToolPreferences } from "@/lib/tool-preferences";
import { cn, formatTemplate } from "@/lib/utils";

export function HeaderSearch() {
  const locale = useLocale();
  const dict = getDictionary(locale);
  const router = useRouter();
  const { favorites, recent } = useToolPreferences();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  const quickTools = [...new Set([...recent, ...favorites])]
    .map(getToolById)
    .filter((tool): tool is Tool => !!tool);
  const results = query.trim()
    ? searchTools(locale, query)
    : quickTools.length
      ? quickTools
      : tools;
  const activeTool = results[activeIndex];

  function changeOpen(next: boolean) {
    setOpen(next);
    setQuery("");
    setActiveIndex(-1);
  }

  React.useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.isComposing
      ) {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  React.useEffect(() => {
    if (activeTool)
      document
        .getElementById(`${listId}-${activeTool.id}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [activeTool, listId]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        event.key === "ArrowDown"
          ? (index + 1) % results.length
          : index <= 0
            ? results.length - 1
            : index - 1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      router.push(getToolPath(locale, (activeTool ?? results[0]).id));
      changeOpen(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          className="w-10 justify-start text-muted-foreground sm:w-full sm:max-w-sm"
          aria-label={dict.header.searchAriaLabel}
          aria-keyshortcuts="Meta+K Control+K"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden min-w-0 truncate sm:inline">
            {dict.header.searchPlaceholder}
          </span>
          <kbd className="ml-auto hidden shrink-0 rounded border px-1 text-[11px] lg:inline">
            ⌘ / Ctrl K
          </kbd>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed top-[10dvh] left-1/2 z-50 flex max-h-[80dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (event.isComposing) event.preventDefault();
          }}
        >
          <Dialog.Title className="sr-only">
            {dict.header.searchAriaLabel}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {dict.discovery.searchHint}
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b p-3">
            <Search
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeTool ? `${listId}-${activeTool.id}` : undefined
              }
              aria-label={dict.header.searchAriaLabel}
              placeholder={dict.discovery.searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0"
            />
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={dict.discovery.closeSearch}
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-muted-foreground">
            <span>
              {query.trim()
                ? dict.home.toolsHeading
                : quickTools.length
                  ? dict.discovery.quickAccess
                  : dict.discovery.allTools}
            </span>
            <span role="status">
              {formatTemplate(dict.discovery.resultCount, {
                count: results.length,
              })}
            </span>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-2">
            {results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {dict.discovery.noResults}
              </p>
            )}
            <div role="listbox" id={listId} aria-label={dict.home.toolsHeading}>
              {results.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.id}
                    id={`${listId}-${tool.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    href={getToolPath(locale, tool.id)}
                    onClick={() => changeOpen(false)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent",
                      index === activeIndex &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <Icon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {tool.name[locale]}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {tool.description[locale]}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            {dict.discovery.searchHint}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
