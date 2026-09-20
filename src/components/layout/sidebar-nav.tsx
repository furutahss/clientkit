"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { categories, getToolPath, getToolsByCategory } from "@/config/tools";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

function findActiveCategoryId(
  pathname: string,
  locale: Locale
): string | undefined {
  return categories.find((category) =>
    getToolsByCategory(category.id).some(
      (tool) => getToolPath(locale, tool.id) === pathname
    )
  )?.id;
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const locale = useLocale();

  // ユーザーが明示的に開閉を切り替えたカテゴリのみを記録する
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});

  // 明示的な切り替えがなければ、現在表示中のツールのカテゴリをデフォルトで展開する
  const activeCategoryId =
    findActiveCategoryId(pathname, locale) ?? categories[0]?.id;

  return (
    <nav className="flex flex-col gap-1 p-4">
      {categories.map((category) => {
        const categoryTools = getToolsByCategory(category.id);
        if (categoryTools.length === 0) return null;
        const isOpen =
          overrides[category.id] ?? category.id === activeCategoryId;

        return (
          <div key={category.id} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() =>
                setOverrides((prev) => ({
                  ...prev,
                  [category.id]: !isOpen,
                }))
              }
              aria-expanded={isOpen}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span>{category.label[locale]}</span>
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 transition-transform",
                  isOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            {isOpen && (
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
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-secondary font-medium text-secondary-foreground"
                            : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{tool.name[locale]}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
