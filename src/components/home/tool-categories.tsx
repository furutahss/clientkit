import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categories, getToolsByCategory } from "@/config/tools";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export function ToolCategories({ lang }: { lang: Locale }) {
  const dict = getDictionary(lang).discovery;
  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="categories-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="categories-heading" className="text-lg font-semibold">
          {dict.categoriesHeading}
        </h2>
        <Link
          href={`/${lang}?view=all`}
          className="text-sm underline underline-offset-4"
        >
          {dict.allTools}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Link
              key={category.id}
              href={`/${lang}#category-${category.id}`}
              className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{category.label[lang]}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {category.description[lang]}
                </span>
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {getToolsByCategory(category.id).length}
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
