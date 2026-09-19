/**
 * openGraph/twitterのmetadataは、セグメントごとに再定義すると
 * 親セグメントのフィールド（imagesを含む）が丸ごと上書きされてしまうため、
 * 画像情報をここで共有し、各generateMetadataでスプレッドして使う。
 */
export const ogImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
};

export const twitterImage = {
  url: "/twitter-image",
  width: 1200,
  height: 630,
};
