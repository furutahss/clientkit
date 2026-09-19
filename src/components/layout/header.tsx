import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { GithubIcon } from "@/components/icons/github-icon";
import { HeaderSearch } from "@/components/layout/header-search";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export function Header({ lang }: { lang: Locale }) {
  const dict = getDictionary(lang);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileSidebar />

      <Link href={`/${lang}`} className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">{siteConfig.name}</span>
      </Link>

      <div className="flex-1 px-2 sm:px-4">
        <HeaderSearch />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <LanguageSwitch ariaLabel={dict.header.languageSwitchAriaLabel} />
        <ThemeToggle ariaLabel={dict.header.themeToggleAriaLabel} />
        <Button variant="ghost" size="icon" asChild>
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={dict.header.githubAriaLabel}
          >
            <GithubIcon className="size-5" />
          </a>
        </Button>
      </div>
    </header>
  );
}
