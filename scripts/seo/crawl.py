#!/usr/bin/env python3
"""静的配信のHTTP応答、全内部リンク、本文、メタ情報をまとめて検証する。"""
import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import deque
from html.parser import HTMLParser
from pathlib import Path

ORIGIN = 'https://clientkit.dev'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.links, self.canonicals, self.languages, self.titles, self.body = [], [], {}, [], []
        self.description, self.noindex, self.stack, self.related, self.footer = [], False, [], [], []
        self.ids, self.alternate_count = set(), 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'): self.ids.add(a['id'])
        if tag == 'a' and 'href' in a:
            self.links.append(a['href'])
            if any('related' in x[1] for x in self.stack): self.related.append(a['href'])
            if any(x[0] == 'footer' for x in self.stack): self.footer.append(a['href'])
        if tag == 'link':
            if a.get('rel') == 'canonical': self.canonicals.append(a.get('href'))
            if a.get('rel') == 'alternate' and 'hreflang' in a:
                self.languages[a['hreflang']] = a.get('href')
                self.alternate_count += 1
        if tag == 'meta':
            if a.get('name') == 'description': self.description.append(a.get('content', ''))
            if a.get('name') in ('robots', 'googlebot') and 'noindex' in a.get('content', ''): self.noindex = True
        if tag not in VOID: self.stack.append((tag, {'body'} if 'data-tool-content' in a else {'related'} if 'data-related-tools' in a else set()))

    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if any(x[0] in ('script', 'style') for x in self.stack): return
        if any(x[0] == 'title' for x in self.stack): self.titles.append(data)
        if any('body' in x[1] for x in self.stack): self.body.append(data)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None

opener = urllib.request.build_opener(NoRedirect)
def get(url, extra_headers=None):
    try:
        with opener.open(urllib.request.Request(url, headers={'User-Agent': 'ClientKit-SEO-Check/1.0', **(extra_headers or {})}), timeout=20) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as response:
        return response.code, response.headers, response.read()

# パーサー自体のチェック: FAQは数え、JSON-LDやUI文言は数えない。
probe = Page('<div>UI</div><div data-tool-content><p>例😀</p><details><summary>質問</summary>回答</details><script>hidden</script></div><link rel="canonical" href="https://clientkit.dev/ja">')
assert ''.join(probe.body) == '例😀質問回答'
assert probe.canonicals == [ORIGIN + '/ja']

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:8787')
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
base = args.base.rstrip('/')
failures = []
def check(condition, message):
    if not condition: failures.append(message)

def target(url):
    parsed = urllib.parse.urlsplit(url)
    return base + parsed.path + (('?' + parsed.query) if parsed.query else '')

registry = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import { tools } from './scripts/seo/data.mjs'; console.log(JSON.stringify(tools.map(t=>t.id)))"], text=True))
expected = {ORIGIN + '/' + lang + suffix for lang in ['ja', 'en'] for suffix in ['', '/about', '/operator', '/contact', '/terms', '/privacy-policy', '/release-notes'] + ['/tools/' + tool for tool in registry]}
status, headers, xml = get(base + '/sitemap.xml')
check(status == 200, f'sitemap status {status}')
if status != 200:
    print(f'sitemap取得失敗: status={status}, Location={headers.get("Location")}')
    sys.exit(1)
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'x': 'http://www.w3.org/1999/xhtml'}
root = ET.fromstring(xml)
urls = [node.find('s:loc', ns).text for node in root.findall('s:url', ns)]
check(len(urls) == len(set(urls)), 'sitemapに重複URL')
check(set(urls) == expected, f'sitemap登録漏れ/余分: {sorted(expected ^ set(urls))}')
for node in root.findall('s:url', ns):
    url = node.find('s:loc', ns).text
    suffix = urllib.parse.urlsplit(url).path[3:]
    expected_languages = {lang: ORIGIN + '/' + lang + suffix for lang in ['ja', 'en']}
    expected_languages['x-default'] = expected_languages['ja']
    check({n.attrib['hreflang']: n.attrib['href'] for n in node.findall('x:link', ns)} == expected_languages, f'{url}: sitemap言語不整合')

queue = deque(urls)
seen, pages, internal_links = set(), {}, set()
fragment_checks = []
while queue:
    url = queue.popleft()
    if url in seen: continue
    seen.add(url)
    status, headers, data = get(target(url))
    check(status == 200, f'{url}: status {status} Location={headers.get("Location")}')
    if status != 200 or 'text/html' not in headers.get('Content-Type', ''): continue
    page = Page(data.decode('utf-8'))
    path = urllib.parse.urlsplit(url).path
    canonical = ORIGIN + path
    pages[url] = page
    check(page.canonicals == [canonical], f'{url}: canonical={page.canonicals}')
    check(not page.noindex, f'{url}: noindex')
    suffix = path[3:]
    languages = {lang: ORIGIN + '/' + lang + suffix for lang in ['ja', 'en']}
    languages['x-default'] = languages['ja']
    check(page.alternate_count == 3, f'{url}: hreflang重複/不足')
    check(bool(page.titles), f'{url}: title欠落')
    check(page.languages == languages, f'{url}: hreflang={page.languages}')
    check(len(page.description) == 1 and bool(page.description[0]), f'{url}: description欠落/複数')
    lang = path.split('/')[1]
    for info in ['about', 'operator', 'contact', 'terms', 'privacy-policy']:
        check('/' + lang + '/' + info in page.footer, f'{url}: footer {info}なし')
    if '/tools/' in path:
        text = ''.join(page.body)
        measure = len(re.sub(r'\s', '', text)) if lang == 'ja' else len(re.findall(r"\b[\w'-]+\b", text))
        check(measure >= (600 if lang == 'ja' else 200), f'{url}: 描画本文不足 {measure}')
        check(len(set(page.related)) >= 2, f'{url}: 関連ツール不足')
    for href in page.links:
        full = urllib.parse.urljoin(url, href)
        parsed = urllib.parse.urlsplit(full)
        if parsed.scheme not in ('https', 'http') or parsed.hostname not in ('clientkit.dev', 'www.clientkit.dev'): continue
        clean = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ''))
        check(parsed.scheme == 'https' and parsed.hostname == 'clientkit.dev', f'{url}: 正規でない内部リンク {href}')
        if parsed.fragment: fragment_checks.append((url, clean, urllib.parse.unquote(parsed.fragment)))
        internal_links.add(clean)
        if clean not in seen: queue.append(clean)

for source, dest, fragment in fragment_checks:
    if dest in pages: check(fragment in pages[dest].ids, f'{source}: アンカー未存在 {dest}#{fragment}')

# 日英相互参照先はsitemap内に存在し、同じ対応表を持つ。
for url in urls:
    page = pages.get(url)
    if not page: continue
    for language, alternate in page.languages.items():
        check(alternate in expected, f'{url}: alternate対象外 {alternate}')
        if alternate in pages: check(pages[alternate].languages == page.languages, f'{url}: alternate相互不整合')
for lang in ['ja', 'en']:
    for field in ['titles', 'description']:
        values = [tuple(getattr(pages[url], field)) for url in urls if '/' + lang + '/' in url + '/' and url in pages]
        check(len(values) == len(set(values)), f'{lang}: {field}重複')
    home = pages.get(ORIGIN + '/' + lang)
    if home:
        for tool in registry: check('/' + lang + '/tools/' + tool in home.links, f'{lang}: ホームから{tool}へのテキストリンクなし')

# root、スラッシュ、旧UUID、.html、index.htmlの応答を実HTTPで調べる。
redirects = {'/': '/ja', '/ja/': '/ja', '/en/': '/en', '/ja.html': '/ja', '/en/index.html': '/en'}
for lang in ['ja', 'en']:
    redirects['/' + lang + '/tools/uuid-generator'] = '/' + lang + '/tools/id-generator'
    redirects['/' + lang + '/tools/uuid-generator/'] = '/' + lang + '/tools/id-generator'
    for tool in registry:
        path = '/' + lang + '/tools/' + tool
        redirects[path + '/'] = path
for source, dest in redirects.items():
    status, headers, _ = get(base + source)
    check(status == 301 and headers.get('Location') in (base + dest, ORIGIN + dest), f'{source}: 301→{dest}でない ({status}, {headers.get("Location")})')
for path in ['/ja/tools/missing-tool', '/en/missing-page', '/fr', '/ja/missing.html']:
    status, _, _ = get(base + path)
    # .htmlは拡張子なしへ正規化後に404が必要。
    if path.endswith('.html'):
        status, _, _ = get(base + path[:-5])
    check(status == 404, f'{path}: 未知URLが{status}を返す')
# 本番を指定した場合はDNS/TLSを含めたHTTP/wwwの実経路も確認する。
host_checks = 0
if urllib.parse.urlsplit(base).hostname == 'clientkit.dev':
    for origin in ('http://clientkit.dev', 'http://www.clientkit.dev', 'https://www.clientkit.dev'):
        status, headers, _ = get(origin + '/en/tools/base64/')
        check(status == 301 and headers.get('Location') == ORIGIN + '/en/tools/base64', f'{origin}: HTTP/www正規化不整合')
        host_checks += 1
status, _, robots = get(base + '/robots.txt')
check(status == 200 and b'Sitemap: https://clientkit.dev/sitemap.xml' in robots and b'Disallow: /\n' not in robots, 'robots不整合')
summary = {'sitemapURLs': len(urls), 'htmlResponses': len(pages), 'internalURLs': len(internal_links), 'redirectChecks': len(redirects), 'hostChecks': host_checks, 'failures': failures}
Path('/private/tmp/clientkit-crawl-audit.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
if args.write:
    with open('docs/seo-audit.md', 'a') as output:
        output.write(f'\n## HTTPクロール検証結果\n\n検証先: `{base}`（本番ビルドのCloudflare Workersローカル配信）。sitemap {len(urls)} URL、HTML応答{len(pages)}件、内部リンク先{len(internal_links)}件、301確認{len(redirects)}件。エラー{len(failures)}件。\n\n本文・title/description一意性・canonical・ja/en/x-default相互整合・フッター・ホーム到達性・関連ツール・robots・未知URLの404を実レスポンスから検証。HTTP/wwwの組合せはWorker単体テストでも検証。本番反映後には同じスクリプトを`--base https://clientkit.dev`で再実行できる。\n')
print(json.dumps(summary, ensure_ascii=False, indent=2))
sys.exit(bool(failures))
