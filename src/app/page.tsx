import type { Metadata } from 'next';
import Link from 'next/link';

// 通常は配信Workerが/jaへ301転送する。静的ファイル単体で開いた際の導線も残す。
export const metadata: Metadata = {
  title: 'ClientKit — Language selection',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://clientkit.dev/ja' },
};

export default function RootPage() {
  return <main className="p-6"><h1>ClientKit</h1><nav className="flex gap-4"><Link href="/ja">日本語</Link><Link href="/en">English</Link></nav></main>;
}
