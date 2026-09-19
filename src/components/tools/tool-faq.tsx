import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { ToolFaqItem } from "@/config/tools";

export function ToolFaq({ lang, faq }: { lang: Locale; faq: ToolFaqItem[] }) {
  const dict = getDictionary(lang);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{dict.toolPage.faqHeading}</h2>
      <dl className="flex flex-col gap-4">
        {faq.map((item, index) => (
          <div key={index} className="flex flex-col gap-1">
            <dt className="font-medium">{item.question[lang]}</dt>
            <dd className="text-sm text-muted-foreground">
              {item.answer[lang]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
