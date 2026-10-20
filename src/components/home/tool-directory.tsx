import Link from 'next/link';
import { categories, getToolPath, getToolsByCategory } from '@/config/tools';
import type { Locale } from '@/i18n/config';

export function ToolDirectory({ lang }: { lang: Locale }) {
  return (
    <section data-tool-directory className="flex flex-col gap-5 border-t pt-6">
      <h2 className="text-xl font-semibold">{lang === 'ja' ? 'カテゴリ別の全ツール一覧' : 'All tools by category'}</h2>
      <p className="text-sm text-muted-foreground">{lang === 'ja' ? '扱うデータや作業の種類から選べます。各ページに使い方、具体例、対応範囲を掲載しています。' : 'Choose by data type or task. Each page includes instructions, examples, and supported limits.'}</p>
      <div className="grid gap-6 sm:grid-cols-2">
        {categories.map(category => (
          <section key={category.id} id={`category-${category.id}`} className="scroll-mt-20 space-y-2">
            <h3 className="font-semibold">{category.label[lang]}</h3>
            <p className="text-xs text-muted-foreground">{category.description[lang]}</p>
            <ul className="space-y-2 text-sm">
              {getToolsByCategory(category.id).map(tool => <li key={tool.id}><Link href={getToolPath(lang, tool.id)} className="underline underline-offset-4">{tool.name[lang]}</Link><p className="mt-1 text-xs text-muted-foreground">{tool.description[lang]}</p></li>)}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
