"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { categories, getToolPath, getToolsByCategory } from "@/config/tools";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <nav className="flex flex-col gap-6 p-4">
      {categories.map((category) => {
        const categoryTools = getToolsByCategory(category.id);
        if (categoryTools.length === 0) return null;

        return (
          <div key={category.id} className="flex flex-col gap-1">
            <h3 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {category.label[locale]}
            </h3>
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
          </div>
        );
      })}
    </nav>
  );
}
