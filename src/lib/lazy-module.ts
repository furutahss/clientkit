"use client";

import * as React from "react";

/**
 * ライブラリを動的インポートで読み込み、読み込み後にその値を返すフック。
 * すべてのツールページで共有されるバンドルに大きなライブラリが含まれないよう、
 * ツールを表示したときに初めて読み込む。loader はモジュールのトップレベルで定義した
 * 関数を渡すこと（呼び出しごとに新しい関数を渡すと再読み込みされる）。
 */
export function useLazyModule<T>(loader: () => Promise<T>): { module: T | null; error: boolean } {
  const [state, setState] = React.useState<{ module: T | null; error: boolean }>({
    module: null,
    error: false,
  });

  React.useEffect(() => {
    let cancelled = false;
    loader()
      .then((module) => {
        if (!cancelled) setState({ module, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ module: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  return state;
}
