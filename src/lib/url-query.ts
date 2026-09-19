export type QueryParam = {
  key: string;
  value: string;
};

export type SplitUrl = {
  base: string;
  queryString: string;
  hash: string;
};

/** URLを「ベース（クエリより前）」「クエリ文字列」「ハッシュ」に分解する */
export function splitUrl(url: string): SplitUrl {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex !== -1 ? url.slice(hashIndex) : "";
  const withoutHash = hashIndex !== -1 ? url.slice(0, hashIndex) : url;

  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex !== -1 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const queryString =
    queryIndex !== -1 ? withoutHash.slice(queryIndex + 1) : "";

  return { base, queryString, hash };
}

export function parseQueryParams(queryString: string): QueryParam[] {
  if (!queryString) return [];
  const searchParams = new URLSearchParams(queryString);
  return Array.from(searchParams.entries()).map(([key, value]) => ({
    key,
    value,
  }));
}

export function buildUrl(
  base: string,
  params: QueryParam[],
  hash: string
): string {
  const validParams = params.filter((p) => p.key !== "");
  if (validParams.length === 0) return `${base}${hash}`;

  const searchParams = new URLSearchParams();
  validParams.forEach((p) => searchParams.append(p.key, p.value));
  return `${base}?${searchParams.toString()}${hash}`;
}
