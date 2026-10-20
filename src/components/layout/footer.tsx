import Link from "next/link";

import { trustPages } from "@/config/trust-pages";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

const linkClassName = "underline-offset-2 hover:text-foreground hover:underline";

export function Footer({ lang }: { lang: Locale }) {
  const dict = getDictionary(lang);

  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t px-4 py-4 text-center text-xs text-muted-foreground">
      {Object.entries(trustPages).map(([id, page]) => (
        <Link key={id} href={`/${lang}/${id}`} className={linkClassName}>
          {page.title[lang]}
        </Link>
      ))}
      <Link href={`/${lang}/release-notes`} className={linkClassName}>
        {dict.footer.releaseNotesLink}
      </Link>
      <Link href={`/${lang}/privacy-policy`} className={linkClassName}>
        {dict.footer.privacyPolicyLink}
      </Link>
    </footer>
  );
}
