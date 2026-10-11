"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Grid2X2, History, House, Star } from "lucide-react";
import {
  categories,
  getToolById,
  getToolPath,
  getToolsByCategory,
  type Tool,
} from "@/config/tools";
import { getDictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import { useToolPreferences } from "@/lib/tool-preferences";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const { favorites, recent } = useToolPreferences();
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});
  const [recentOpen, setRecentOpen] = React.useState(false);
  const activeCategoryId = categories.find((category) =>
    getToolsByCategory(category.id).some(
      (tool) => getToolPath(locale, tool.id) === pathname,
    ),
  )?.id;
  const navClass =
    "flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground";

  function toolLinks(categoryTools: Tool[]) {
    return (
      <ul className="flex flex-col gap-0.5">
        {categoryTools.map((tool) => {
          const path = getToolPath(locale, tool.id);
          const isActive = pathname === path;
          const Icon = tool.icon;
          return (
            <li key={tool.id}>
              <Link
                href={path}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  navClass,
                  "items-start pl-4",
                  isActive
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-foreground/80",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words leading-snug">
                  {tool.name[locale]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  const selectedTools = (ids: string[]) =>
    ids.map(getToolById).filter((tool): tool is Tool => !!tool);

  return (
    <nav
      className="flex flex-col gap-1 p-3"
      aria-label={dict.sidebar.mobileTitle}
    >
      <Link href={`/${locale}`} onClick={onNavigate} className={navClass}>
        <House className="size-4 shrink-0" aria-hidden="true" />
        {dict.breadcrumb.home}
      </Link>
      <div>
        <Link
          href={`/${locale}?view=favorites`}
          onClick={onNavigate}
          className={navClass}
        >
          <Star className="size-4 shrink-0" aria-hidden="true" />
          {dict.discovery.favorites}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {favorites.length}
          </span>
        </Link>
        {favorites.length > 0 &&
          toolLinks(selectedTools(favorites.slice(0, 5)))}
      </div>
      <div>
        <div className="flex items-center">
          <Link
            href={`/${locale}?view=recent`}
            onClick={onNavigate}
            className={cn(navClass, "flex-1")}
          >
            <History className="size-4 shrink-0" aria-hidden="true" />
            {dict.discovery.recent}
          </Link>
          {recent.length > 0 && (
            <button
              type="button"
              onClick={() => setRecentOpen((value) => !value)}
              aria-expanded={recentOpen}
              aria-label={dict.discovery.recent}
              className="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
            >
              <ChevronDown
                className={cn("size-4", recentOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
        {recentOpen && toolLinks(selectedTools(recent))}
      </div>
      <p className="mt-5 mb-2 px-2 text-xs font-medium text-muted-foreground">
        {dict.discovery.categoriesHeading}
      </p>
      {categories.map((category) => {
        const categoryTools = getToolsByCategory(category.id);
        const isOpen =
          overrides[category.id] ?? category.id === activeCategoryId;
        const Icon = category.icon;
        return (
          <div key={category.id}>
            <button
              type="button"
              onClick={() =>
                setOverrides((prev) => ({ ...prev, [category.id]: !isOpen }))
              }
              aria-expanded={isOpen}
              className={cn(navClass, "w-full text-left")}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{category.label[locale]}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {categoryTools.length}
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground",
                  isOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {isOpen && toolLinks(categoryTools)}
          </div>
        );
      })}
      <Link
        href={`/${locale}?view=all`}
        onClick={onNavigate}
        className={cn(navClass, "mt-2")}
      >
        <Grid2X2 className="size-4 shrink-0" aria-hidden="true" />
        {dict.discovery.allTools}
      </Link>
    </nav>
  );
}
