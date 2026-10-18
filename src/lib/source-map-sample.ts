/** Source Map復元ツールのサンプル（src/cart.js を terser で圧縮して生成したもの） */
export const SAMPLE_SOURCE_MAP = `{"version":3,"file":"app.min.js","names":["addToCart","cart","item","id","Error","existing","items","find","entry","quantity","push","reduce","sum","price","calculateTotal"],"sources":["src/cart.js"],"sourcesContent":["export function addToCart(cart, item) {\\n  if (!item.id) {\\n    throw new Error(\\"item.id is required\\");\\n  }\\n  const existing = cart.items.find((entry) => entry.id === item.id);\\n  if (existing) {\\n    existing.quantity += item.quantity;\\n  } else {\\n    cart.items.push({ ...item });\\n  }\\n  return calculateTotal(cart);\\n}\\n\\nfunction calculateTotal(cart) {\\n  return cart.items.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);\\n}\\n"],"mappings":"OAAO,SAASA,UAAUC,EAAMC,GAC9B,IAAKA,EAAKC,GACR,MAAM,IAAIC,MAAM,uBAElB,MAAMC,EAAWJ,EAAKK,MAAMC,KAAMC,GAAUA,EAAML,KAAOD,EAAKC,IAM9D,OALIE,EACFA,EAASI,UAAYP,EAAKO,SAE1BR,EAAKK,MAAMI,KAAK,IAAKR,IAKzB,SAAwBD,GACtB,OAAOA,EAAKK,MAAMK,OAAO,CAACC,EAAKJ,IAAUI,EAAMJ,EAAMK,MAAQL,EAAMC,SAAU,EAC/E,CALSK,CAAeb,EACxB"}`;

export const SAMPLE_STACK = `TypeError: Cannot read properties of undefined (reading 'find')
    at addToCart (https://example.com/assets/app.min.js:1:88)
    at HTMLButtonElement.onClick (https://example.com/assets/vendor.js:2:1530)
    at https://example.com/assets/app.min.js?v=3:1:189
    at <anonymous>`;
