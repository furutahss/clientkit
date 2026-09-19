"use client";

import { useEffect } from "react";

import { defaultLocale, locales, type Locale } from "@/i18n/config";

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;

  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const candidate of candidates) {
    const lang = candidate.toLowerCase().split("-")[0];
    if ((locales as readonly string[]).includes(lang)) {
      return lang as Locale;
    }
  }

  return defaultLocale;
}

export default function RootPage() {
  useEffect(() => {
    const locale = detectLocale();
    window.location.replace(`/${locale}`);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
      <p>
        Redirecting... / リダイレクト中...
        <noscript>
          <br />
          <a href={`/${defaultLocale}`} className="underline">
            Continue to ClientKit
          </a>
        </noscript>
      </p>
    </div>
  );
}
