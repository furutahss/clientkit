import Link from 'next/link';
import { getToolPath, getToolsByCategory, tools, type Tool } from '@/config/tools';
import type { Locale } from '@/i18n/config';

export function RelatedTools({ tool, lang }: { tool: Tool; lang: Locale }) {
  const adjacent = tool.category === 'document' ? ['ocr', 'image-converter'] : tool.category === 'time' ? ['id-generator', 'certificate-decoder'] : [];
  const related = [...getToolsByCategory(tool.category), ...tools.filter(candidate => adjacent.includes(candidate.id))].filter(candidate => candidate.id !== tool.id).slice(0, 3);
  return (
    <nav data-related-tools aria-labelledby="related-tools-heading" className="flex flex-col gap-3 border-t pt-6">
      <h2 id="related-tools-heading" className="text-lg font-semibold">{lang === 'ja' ? '関連ツール' : 'Related tools'}</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {related.map(candidate => <li key={candidate.id} className="rounded-lg border p-4 text-sm"><Link href={getToolPath(lang, candidate.id)} className="font-medium underline underline-offset-4">{candidate.name[lang]}</Link><p className="mt-2 text-xs text-muted-foreground">{candidate.description[lang]}</p></li>)}
      </ul>
    </nav>
  );
}
