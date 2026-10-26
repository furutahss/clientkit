// 静的HTMLでも配信前に正規URLへ寄せ、言語推測によるURLの揺れを防ぐ。
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const original = url.href;
    if (url.hostname === 'clientkit.dev' || url.hostname === 'www.clientkit.dev') {
      url.protocol = 'https:';
      url.hostname = 'clientkit.dev';
      url.port = '';
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    url.pathname = url.pathname.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\/+$/, '') || '/ja';
    url.pathname = url.pathname.replace(/^\/(ja|en)\/tools\/uuid-generator$/, '/$1/tools/id-generator');
    // 多言語化前の実在ページだけを引き継ぎ、存在しない旧パスは404を維持する。
    if (/^\/tools\/[a-z0-9-]+$/.test(url.pathname)) {
      const target = new URL(url);
      target.pathname = `/ja${url.pathname}`.replace(/\/uuid-generator$/, '/id-generator');
      const asset = await env.ASSETS.fetch(new Request(target, { method: 'HEAD' }));
      if (asset.status === 200) url.pathname = target.pathname;
    }
    if (url.href !== original) return Response.redirect(url.href, 301);
    return env.ASSETS.fetch(request);
  },
};

export default worker;
