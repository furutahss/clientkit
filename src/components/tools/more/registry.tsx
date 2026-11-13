"use client";

/**
 * 追加ツールのコンポーネント登録。入出力が「テキスト／ファイル → 結果」の形のツールは
 * specs/ の設定（ToolSpec）を共通のSpecToolで描画し、それ以外は専用コンポーネントを読み込む。
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import { SpecTool } from "@/components/tools/more/kit";
import { SPEC_IDS } from "@/components/tools/more/spec-ids";
import type { ToolSpec } from "@/lib/more/types";

type SpecModule = { specs: Record<string, ToolSpec> };

function fromSpecs(id: string, load: () => Promise<SpecModule>): ComponentType {
  return dynamic(() => load().then((m) => ({ default: () => <SpecTool id={id} spec={m.specs[id]} /> })));
}

function custom(load: () => Promise<{ default: ComponentType }>): ComponentType {
  return dynamic(load);
}

const loaders: Record<keyof typeof SPEC_IDS, () => Promise<SpecModule>> = {
  web: () => import("@/components/tools/more/specs/web"),
  security: () => import("@/components/tools/more/specs/security"),
  data: () => import("@/components/tools/more/specs/data"),
  text: () => import("@/components/tools/more/specs/text"),
  code: () => import("@/components/tools/more/specs/code"),
  media: () => import("@/components/tools/more/specs/media"),
};

const moreToolComponents: Record<string, ComponentType> = {
  ...Object.fromEntries((Object.keys(SPEC_IDS) as (keyof typeof SPEC_IDS)[]).flatMap((group) => SPEC_IDS[group].map((id) => [id, fromSpecs(id, loaders[group])]))),
  "keyboard-inspector": custom(() => import("@/components/tools/more/keyboard-inspector-tool").then((m) => ({ default: m.KeyboardInspectorTool }))),
  "folder-compare": custom(() => import("@/components/tools/more/folder-compare-tool").then((m) => ({ default: m.FolderCompareTool }))),
};

/** サーバーコンポーネントからは、IDだけを渡してここで対応するツールを描画する（"use client" のモジュールからは関数・コンポーネントしか渡せないため） */
export function MoreToolHost({ id }: { id: string }) {
  const Tool = moreToolComponents[id];
  return Tool ? <Tool /> : null;
}
