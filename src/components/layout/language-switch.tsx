"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { locales, type Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

export function LanguageSwitch({ ariaLabel }: { ariaLabel: string }) {
  const pathname = usePathname() ?? "/";
  const locale = useLocale();

  function localizedHref(target: Locale) {
    const segments = pathname.split("/");
    segments[1] = target;
    return segments.join("/") || `/${target}`;
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 rounded-md border p-0.5 text-xs font-medium"
    >
      {locales.map((l) => (
        <Link
          key={l}
          href={localizedHref(l)}
          aria-current={locale === l ? "true" : undefined}
          className={cn(
            "rounded-sm px-2 py-1 uppercase transition-colors",
            locale === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}
