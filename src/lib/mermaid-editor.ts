/**
 * Mermaid図エディタで使う純粋関数とテンプレート。図の描画は mermaid（ブラウザのDOMが必要）で行う。
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

export type MermaidTheme = "default" | "dark" | "forest" | "neutral";
export const MERMAID_THEMES: MermaidTheme[] = ["default", "dark", "forest", "neutral"];

export type TemplateId = "flowchart" | "sequence" | "er" | "class" | "state" | "gantt" | "mindmap" | "gitGraph";

export const TEMPLATES: Record<TemplateId, string> = {
  flowchart: `flowchart TD
    A[注文を受け付ける] --> B{在庫はある？}
    B -- はい --> C[商品を発送する]
    B -- いいえ --> D[入荷を待つ]
    D --> B
    C --> E([完了])`,
  sequence: `sequenceDiagram
    actor ユーザー
    participant ブラウザ
    participant サーバー
    ユーザー->>ブラウザ: ログインボタンを押す
    ブラウザ->>サーバー: 認証リクエスト
    サーバー-->>ブラウザ: トークンを返す
    ブラウザ-->>ユーザー: ダッシュボードを表示`,
  er: `erDiagram
    顧客 ||--o{ 注文 : "行う"
    注文 ||--|{ 注文明細 : "含む"
    商品 ||--o{ 注文明細 : "対象"
    顧客 {
        int id PK
        string 氏名
        string メールアドレス
    }
    注文 {
        int id PK
        int 顧客id FK
        date 注文日
    }`,
  class: `classDiagram
    class 動物 {
        +String 名前
        +鳴く() void
    }
    class 犬 {
        +散歩する() void
    }
    class 猫 {
        +爪をとぐ() void
    }
    動物 <|-- 犬
    動物 <|-- 猫`,
  state: `stateDiagram-v2
    [*] --> 下書き
    下書き --> レビュー中 : 提出
    レビュー中 --> 下書き : 差し戻し
    レビュー中 --> 公開済み : 承認
    公開済み --> [*]`,
  gantt: `gantt
    title Webサイト制作スケジュール
    dateFormat YYYY-MM-DD
    section 設計
    要件定義     :done,    a1, 2026-01-05, 5d
    デザイン     :active,  a2, after a1, 7d
    section 開発
    実装         :         b1, after a2, 10d
    テスト       :         b2, after b1, 5d`,
  mindmap: `mindmap
  root((新サービス))
    目的
      業務の効率化
      コスト削減
    機能
      ログイン
      レポート出力
    課題
      予算
      スケジュール`,
  gitGraph: `gitGraph
    commit id: "初回コミット"
    branch feature
    checkout feature
    commit id: "機能を追加"
    commit id: "テストを追加"
    checkout main
    merge feature
    commit id: "リリース"`,
};

export type ShareState = { code: string; theme: MermaidTheme; background: string };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** 図の内容を圧縮して URL のハッシュに入れられる文字列にする */
export function encodeShareState(state: ShareState): string {
  return toBase64Url(deflateSync(strToU8(JSON.stringify(state)), { level: 9 }));
}

/** URL のハッシュから図の内容を取り出す。不正な値なら null */
export function decodeShareState(encoded: string): ShareState | null {
  try {
    const parsed = JSON.parse(strFromU8(inflateSync(fromBase64Url(encoded)))) as Partial<ShareState>;
    if (typeof parsed.code !== "string") return null;
    return {
      code: parsed.code,
      theme: MERMAID_THEMES.includes(parsed.theme as MermaidTheme) ? (parsed.theme as MermaidTheme) : "default",
      background: typeof parsed.background === "string" && /^(transparent|#[0-9a-f]{6})$/i.test(parsed.background) ? parsed.background : "#ffffff",
    };
  } catch {
    return null;
  }
}

/** mermaid のエラーメッセージから行番号を取り出す */
export function errorLine(message: string): number | null {
  const match = message.match(/(?:on line|line:?)\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

/** SVG の viewBox から位置と大きさを取り出す */
export function svgViewBox(svg: string): { x: number; y: number; width: number; height: number } | null {
  const match = svg.match(/<svg[^>]*\sviewBox="([-\d.e]+)[ ,]+([-\d.e]+)[ ,]+([\d.e]+)[ ,]+([\d.e]+)"/i);
  if (!match) return null;
  const [x, y, width, height] = match.slice(1).map(Number);
  return { x, y, width, height };
}

/** SVG の先頭に背景の矩形を入れる（透過の場合はそのまま） */
export function withBackground(svg: string, background: string): string {
  if (background === "transparent") return svg;
  const box = svgViewBox(svg);
  if (!box) return svg;
  const rect = `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${background}"/>`;
  return svg.replace(/(<svg[^>]*>)/i, `$1${rect}`);
}

/** SVG に幅と高さ（px）を明示する。画像として描画する際に大きさが決まるようにする */
export function withSize(svg: string, width: number, height: number): string {
  return svg.replace(/<svg([^>]*)>/i, (_, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/gi, "").replace(/\sstyle="[^"]*max-width[^"]*"/i, "");
    return `<svg${cleaned} width="${width}" height="${height}">`;
  });
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** 図全体が表示領域に収まる倍率（拡大はしない） */
export function fitZoom(content: { width: number; height: number }, container: { width: number; height: number }, padding = 16): number {
  if (content.width <= 0 || content.height <= 0) return 1;
  const k = Math.min((container.width - padding * 2) / content.width, (container.height - padding * 2) / content.height);
  return clampZoom(Math.min(1, k));
}

export type TextEdit = { value: string; start: number; end: number };

/**
 * Tab キーによる字下げ。選択範囲がなければカーソル位置に空白を入れ、複数行を選択していれば各行の先頭に入れる。
 * outdent が true の場合（Shift+Tab）は各行の先頭の空白を取り除く。
 */
export function indentText(value: string, start: number, end: number, outdent: boolean, unit = "  "): TextEdit {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  if (!outdent && start === end) {
    return { value: value.slice(0, start) + unit + value.slice(end), start: start + unit.length, end: start + unit.length };
  }
  const blockEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const lines = value.slice(lineStart, blockEnd).split("\n");
  let firstDelta = 0;
  let totalDelta = 0;
  const changed = lines.map((line, index) => {
    if (!outdent) {
      totalDelta += unit.length;
      if (index === 0) firstDelta = unit.length;
      return unit + line;
    }
    const remove = line.match(new RegExp(`^ {1,${unit.length}}|^\\t`))?.[0].length ?? 0;
    totalDelta -= remove;
    if (index === 0) firstDelta = -remove;
    return line.slice(remove);
  });
  const next = value.slice(0, lineStart) + changed.join("\n") + value.slice(blockEnd);
  return { value: next, start: Math.max(lineStart, start + firstDelta), end: Math.max(lineStart, end + totalDelta) };
}
