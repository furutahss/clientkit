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
    if (url.href !== original) return Response.redirect(url.href, 301);
    return env.ASSETS.fetch(request);
  },
};

export default worker;
