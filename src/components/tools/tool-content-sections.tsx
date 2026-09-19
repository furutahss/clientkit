import { ChevronDown } from "lucide-react";

export type FaqItem = {
  question: string;
  answer: string;
};

export type ToolContentSectionsProps = {
  /** 「使い方」セクションの手順（番号付きリストで表示） */
  howToUse: string[];
  /** ツールの解説文章（段落ごとに配列で渡す） */
  about: {
    heading?: string;
    paragraphs: string[];
  };
  /** よくある質問 */
  faqs: FaqItem[];
};

/**
 * 各ツールページの下部に配置する共通コンテンツ（使い方・解説・FAQ）。
 * SEO・AdSense審査対策として、ツールの実用的な説明文を掲載する。
 * FAQには構造化データ（FAQPage）も付与する。
 */
export function ToolContentSections({
  howToUse,
  about,
  faqs,
}: ToolContentSectionsProps) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="flex flex-col gap-10 border-t pt-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">使い方</h2>
        <ol className="flex flex-col gap-1.5 pl-5 text-sm text-muted-foreground marker:text-foreground/60 list-decimal">
          {howToUse.map((step, index) => (
            <li key={index} className="leading-relaxed">
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {about.heading ?? "このツールについて"}
        </h2>
        {about.paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">よくある質問</h2>
        <div className="flex flex-col divide-y rounded-lg border">
          {faqs.map((faq, index) => (
            <details key={index} className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium marker:content-none">
                <span>{faq.question}</span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  );
}
