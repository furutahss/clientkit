import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({
  lang,
  items,
}: {
  lang: Locale;
  items: BreadcrumbItem[];
}) {
  const dict = getDictionary(lang);

  return (
    <nav
      aria-label={dict.breadcrumb.ariaLabel}
      className="flex items-center text-sm text-muted-foreground"
    >
      <ol className="flex items-center gap-1.5">
        <li className="flex items-center gap-1.5">
          <Link
            href={`/${lang}`}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <Home className="size-3.5" />
            <span>{dict.breadcrumb.home}</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5" />
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
