import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { GithubIcon } from "@/components/icons/github-icon";
import { HeaderSearch } from "@/components/layout/header-search";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileSidebar />

      <Link href="/" className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">{siteConfig.name}</span>
      </Link>

      <div className="flex-1 px-2 sm:px-4">
        <HeaderSearch />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild>
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="GitHubリポジトリ"
          >
            <GithubIcon className="size-5" />
          </a>
        </Button>
      </div>
    </header>
  );
}
