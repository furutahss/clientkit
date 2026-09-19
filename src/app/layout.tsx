import type { Metadata } from "next";

import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { siteConfig, getSiteText } from "@/config/site";
import { defaultLocale, locales } from "@/i18n/config";
import { geistMono, geistSans } from "@/lib/fonts";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.name,
  description: getSiteText(defaultLocale).description,
};

// Sets the initial `<html lang>` from the URL before hydration, so a direct
// load of e.g. /en doesn't briefly show the default "ja" lang attribute.
const syncLangScript = `(function(){try{var seg=location.pathname.split("/")[1];var locales=${JSON.stringify(locales)};if(locales.indexOf(seg)!==-1){document.documentElement.lang=seg;}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={defaultLocale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: syncLangScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
