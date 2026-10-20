import { describe, expect, it } from 'vitest';
import worker from './index.mjs';

const env = { ASSETS: { fetch: async (request: Request) => new Response(new URL(request.url).pathname) } };

describe('配信URLの正規化', () => {
  it.each([
    ['http://www.clientkit.dev/en/tools/base64/?a=1', 'https://clientkit.dev/en/tools/base64?a=1'],
    ['http://clientkit.dev/ja', 'https://clientkit.dev/ja'],
    ['https://www.clientkit.dev/', 'https://clientkit.dev/ja'],
    ['https://clientkit.dev/', 'https://clientkit.dev/ja'],
    ['https://clientkit.dev/en/index.html', 'https://clientkit.dev/en'],
    ['https://clientkit.dev/en/tools/base64.html', 'https://clientkit.dev/en/tools/base64'],
    ['https://clientkit.dev/ja/tools/uuid-generator/', 'https://clientkit.dev/ja/tools/id-generator'],
  ])('%sを1回の301で%sに集約する', async (source, target) => {
    const response = await worker.fetch(new Request(source), env);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(target);
  });
  it('正規URLと静的ファイルをそのまま配信する', async () => {
    for (const path of ['/en/tools/base64', '/robots.txt', '/_next/static/chunk.js', '/models/u2netp.onnx']) {
      const response = await worker.fetch(new Request(`https://clientkit.dev${path}`), env);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(path);
    }
  });
  it('localhostで本番ドメインへ転送しない', async () => {
    const response = await worker.fetch(new Request('http://localhost:8787/ja'), env);
    expect(response.status).toBe(200);
  });
});
