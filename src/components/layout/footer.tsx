import Link from "next/link";

import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

export function Footer({ lang }: { lang: Locale }) {
  const dict = getDictionary(lang);

  return (
    <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
      <Link
        href={`/${lang}/release-notes`}
        className="underline-offset-2 hover:text-foreground hover:underline"
      >
        {dict.footer.releaseNotesLink}
      </Link>
    </footer>
  );
}
