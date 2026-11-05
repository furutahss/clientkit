/**
 * TeX の数式を MathJax で SVG に変換する。SVG はグリフをパスとして含むため、
 * フォントがない環境でもそのまま PNG などの画像に書き出せる。
 * mathjax-full は大きいため、このモジュールはツールのページで動的に読み込む。
 */
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

import { svgViewBox, withBackground, withSize } from "@/lib/mermaid-editor";

export type TexRenderer = (tex: string, display: boolean) => string;

/** 数式をレンダリングする関数を作る。構文エラーは例外として投げる */
export function createTexRenderer(): TexRenderer {
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  // require・autoload は動的な読み込みを行うため、noundefined は未定義のコマンドをエラーにするため除外する
  const packages = AllPackages.filter((name) => !["require", "autoload", "noundefined"].includes(name));
  const tex = new TeX({
    packages,
    formatError: (_jax: unknown, error: Error) => {
      throw error;
    },
  });
  // fontCache: "local" で、グリフの定義を SVG の中に持たせる（単体の画像として成立させる）
  const svg = new SVG({ fontCache: "local" });
  const doc = mathjax.document("", { InputJax: tex, OutputJax: svg });
  return (source, display) => {
    const node = doc.convert(source, { display });
    const html = adaptor.innerHTML(node);
    // 描画時のエラーは data-mjx-error 付きの要素として返る
    const message = html.match(/data-mjx-error="([^"]*)"/)?.[1];
    if (message) throw new Error(message);
    return html;
  };
}

export type ImageOptions = {
  /** 1em あたりの px（文字の大きさ） */
  fontSize: number;
  /** 余白（px） */
  padding: number;
  color: string;
  /** "transparent" で透過 */
  background: string;
};

/** MathJax の SVG に文字色・余白・背景・px の大きさを付け、単体の画像にする */
export function toImageSvg(svg: string, options: ImageOptions): { svg: string; width: number; height: number } {
  const box = svgViewBox(svg);
  if (!box) throw new Error("viewBox");
  // MathJax の viewBox は 1em = 1000 単位
  const unit = 1000 / options.fontSize;
  const pad = options.padding * unit;
  const width = Math.max(1, Math.ceil((box.width + pad * 2) / unit));
  const height = Math.max(1, Math.ceil((box.height + pad * 2) / unit));
  // px に切り上げた分も viewBox に含め、縦横比のずれで背景の端が欠けないようにする
  const view = { x: box.x - pad, y: box.y - pad, width: (width * 1000) / options.fontSize, height: (height * 1000) / options.fontSize };
  const sized = withSize(svg, width, height).replace(/<svg([^>]*)>/, (_, attrs: string) => {
    const cleaned = attrs.replace(/\s(viewBox|style|color)="[^"]*"/g, "");
    return `<svg${cleaned} viewBox="${view.x} ${view.y} ${view.width} ${view.height}" color="${options.color}">`;
  });
  return { svg: withBackground(sized, options.background), width, height };
}

export type Snippet = {
  /** ボタンに表示する文字 */
  label: string;
  /** 挿入する TeX。"$" の位置にカーソル（選択中の文字列）が入る */
  tex: string;
};

const symbols = (list: string): Snippet[] =>
  list.split(" ").map((item) => {
    const at = item.indexOf("=");
    return { label: item.slice(0, at), tex: `${item.slice(at + 1)} ` };
  });

export const SNIPPET_GROUPS = {
  structures: [
    { label: "a/b", tex: "\\frac{$}{}" },
    { label: "√", tex: "\\sqrt{$}" },
    { label: "ⁿ√", tex: "\\sqrt[n]{$}" },
    { label: "xⁿ", tex: "^{$}" },
    { label: "xₙ", tex: "_{$}" },
    { label: "xₙⁿ", tex: "_{$}^{}" },
    { label: "Σ", tex: "\\sum_{i=1}^{n} $" },
    { label: "Π", tex: "\\prod_{i=1}^{n} $" },
    { label: "∫", tex: "\\int_{a}^{b} $ \\, dx" },
    { label: "∬", tex: "\\iint_{D} $ \\, dx\\,dy" },
    { label: "∮", tex: "\\oint_{C} $" },
    { label: "lim", tex: "\\lim_{x \\to \\infty} $" },
    { label: "d/dx", tex: "\\frac{d}{dx} $" },
    { label: "∂/∂x", tex: "\\frac{\\partial $}{\\partial x}" },
    { label: "(n k)", tex: "\\binom{n}{k}$" },
    { label: "log", tex: "\\log_{$}" },
    { label: "sin", tex: "\\sin $" },
    { label: "cos", tex: "\\cos $" },
    { label: "tan", tex: "\\tan $" },
    { label: "exp", tex: "\\exp\\left($\\right)" },
    { label: "ln", tex: "\\ln $" },
    { label: "max", tex: "\\max_{$}" },
    { label: "min", tex: "\\min_{$}" },
    { label: "argmax", tex: "\\underset{$}{\\operatorname{arg\\,max}}" },
  ],
  brackets: [
    { label: "( )", tex: "\\left( $ \\right)" },
    { label: "[ ]", tex: "\\left[ $ \\right]" },
    { label: "{ }", tex: "\\left\\{ $ \\right\\}" },
    { label: "| |", tex: "\\left| $ \\right|" },
    { label: "‖ ‖", tex: "\\left\\| $ \\right\\|" },
    { label: "⟨ ⟩", tex: "\\left\\langle $ \\right\\rangle" },
    { label: "⌊ ⌋", tex: "\\left\\lfloor $ \\right\\rfloor" },
    { label: "⌈ ⌉", tex: "\\left\\lceil $ \\right\\rceil" },
    { label: "⏞", tex: "\\overbrace{$}^{}" },
    { label: "⏟", tex: "\\underbrace{$}_{}" },
  ],
  matrices: [
    { label: "(2×2)", tex: "\\begin{pmatrix} $a & b \\\\ c & d \\end{pmatrix}" },
    { label: "[2×2]", tex: "\\begin{bmatrix} $a & b \\\\ c & d \\end{bmatrix}" },
    { label: "|2×2|", tex: "\\begin{vmatrix} $a & b \\\\ c & d \\end{vmatrix}" },
    { label: "(3×3)", tex: "\\begin{pmatrix} $a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33} \\end{pmatrix}" },
    { label: "(m×n)", tex: "\\begin{pmatrix} $a_{11} & \\cdots & a_{1n} \\\\ \\vdots & \\ddots & \\vdots \\\\ a_{m1} & \\cdots & a_{mn} \\end{pmatrix}" },
    { label: "cases", tex: "\\begin{cases} $ & \\text{if } x \\ge 0 \\\\  & \\text{otherwise} \\end{cases}" },
    { label: "align", tex: "\\begin{aligned} $ &= \\\\ &= \\end{aligned}" },
    { label: "array", tex: "\\begin{array}{c|c} $ &  \\\\ \\hline  &  \\end{array}" },
    { label: "↵", tex: " \\\\\n$" },
    { label: "&", tex: " & $" },
  ],
  accents: [
    { label: "â", tex: "\\hat{$}" },
    { label: "ā", tex: "\\bar{$}" },
    { label: "a⃗", tex: "\\vec{$}" },
    { label: "ȧ", tex: "\\dot{$}" },
    { label: "ä", tex: "\\ddot{$}" },
    { label: "ã", tex: "\\tilde{$}" },
    { label: "a̅b̅", tex: "\\overline{$}" },
    { label: "a̲b̲", tex: "\\underline{$}" },
    { label: "AB⃗", tex: "\\overrightarrow{$}" },
    { label: "âb", tex: "\\widehat{$}" },
    { label: "ℝ", tex: "\\mathbb{$}" },
    { label: "𝒜", tex: "\\mathcal{$}" },
    { label: "𝔄", tex: "\\mathfrak{$}" },
    { label: "𝐀", tex: "\\mathbf{$}" },
    { label: "𝜶", tex: "\\boldsymbol{$}" },
    { label: "Ar", tex: "\\mathrm{$}" },
    { label: "Abc", tex: "\\text{$}" },
    { label: "■", tex: "\\color{red}{$}" },
    { label: "▢", tex: "\\boxed{$}" },
    { label: "a̸", tex: "\\cancel{$}" },
  ],
  greek: symbols(
    "α=\\alpha β=\\beta γ=\\gamma δ=\\delta ε=\\epsilon ϵ=\\varepsilon ζ=\\zeta η=\\eta θ=\\theta ϑ=\\vartheta ι=\\iota κ=\\kappa λ=\\lambda μ=\\mu ν=\\nu ξ=\\xi π=\\pi ρ=\\rho σ=\\sigma τ=\\tau υ=\\upsilon φ=\\phi ϕ=\\varphi χ=\\chi ψ=\\psi ω=\\omega Γ=\\Gamma Δ=\\Delta Θ=\\Theta Λ=\\Lambda Ξ=\\Xi Π=\\Pi Σ=\\Sigma Φ=\\Phi Ψ=\\Psi Ω=\\Omega"
  ),
  operators: symbols(
    "±=\\pm ∓=\\mp ×=\\times ÷=\\div ·=\\cdot ∘=\\circ ∗=\\ast ⊕=\\oplus ⊗=\\otimes ⊙=\\odot †=\\dagger ∇=\\nabla ∂=\\partial ∞=\\infty ℏ=\\hbar ℓ=\\ell ′=' …=\\ldots ⋯=\\cdots ⋮=\\vdots ⋱=\\ddots °=^\\circ ∠=\\angle △=\\triangle"
  ),
  relations: symbols(
    "≤=\\leq ≥=\\geq ≠=\\neq ≈=\\approx ≡=\\equiv ≅=\\cong ∼=\\sim ≃=\\simeq ∝=\\propto ≪=\\ll ≫=\\gg ≔=\\coloneqq ≝=\\stackrel{\\text{def}}{=} ⊥=\\perp ∥=\\parallel ∣=\\mid"
  ),
  arrows: symbols(
    "→=\\to ←=\\leftarrow ↔=\\leftrightarrow ⇒=\\Rightarrow ⇐=\\Leftarrow ⇔=\\Leftrightarrow ⟹=\\implies ⟺=\\iff ↦=\\mapsto ↑=\\uparrow ↓=\\downarrow ⇀=\\rightharpoonup ⇌=\\rightleftharpoons ↗=\\nearrow ↘=\\searrow"
  ).concat([
    { label: "→ᵃ", tex: "\\xrightarrow{$}" },
    { label: "←ᵃ", tex: "\\xleftarrow{$}" },
  ]),
  sets: symbols(
    "∈=\\in ∉=\\notin ∋=\\ni ⊂=\\subset ⊃=\\supset ⊆=\\subseteq ⊇=\\supseteq ∪=\\cup ∩=\\cap ∖=\\setminus ∅=\\emptyset ∀=\\forall ∃=\\exists ∄=\\nexists ¬=\\neg ∧=\\land ∨=\\lor ⊢=\\vdash ⊨=\\models ∴=\\therefore ∵=\\because ℕ=\\mathbb{N} ℤ=\\mathbb{Z} ℚ=\\mathbb{Q} ℝ=\\mathbb{R} ℂ=\\mathbb{C}"
  ),
  spaces: [
    { label: "⎵ \\,", tex: "\\, $" },
    { label: "⎵ \\;", tex: "\\; $" },
    { label: "⎵ \\quad", tex: "\\quad $" },
    { label: "⎵ \\qquad", tex: "\\qquad $" },
    { label: "⇤ \\!", tex: "\\! $" },
  ],
} satisfies Record<string, Snippet[]>;

export type SnippetGroup = keyof typeof SNIPPET_GROUPS;

export const EXAMPLES = {
  quadratic: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  euler: "e^{i\\pi} + 1 = 0",
  gaussian: "\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}",
  taylor: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x - a)^n",
  maxwell: "\\begin{aligned}\n\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\\n\\nabla \\cdot \\mathbf{B} &= 0 \\\\\n\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\\n\\nabla \\times \\mathbf{B} &= \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}\n\\end{aligned}",
  bayes: "P(A \\mid B) = \\frac{P(B \\mid A) \\, P(A)}{P(B)}",
  normal: "f(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}} \\exp\\left( -\\frac{(x - \\mu)^2}{2\\sigma^2} \\right)",
  matrix: "A = \\begin{pmatrix} a_{11} & a_{12} \\\\ a_{21} & a_{22} \\end{pmatrix}, \\quad \\det A = a_{11}a_{22} - a_{12}a_{21}",
  schrodinger: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\hat{H} \\Psi(\\mathbf{r}, t)",
  piecewise: "|x| = \\begin{cases} x & \\text{if } x \\ge 0 \\\\ -x & \\text{otherwise} \\end{cases}",
} as const;

export type ExampleId = keyof typeof EXAMPLES;

/** スニペットを挿入した結果。選択中の文字列は "$" の位置に入り、カーソルはその後ろに置く */
export function applySnippet(
  value: string,
  start: number,
  end: number,
  snippet: string
): { value: string; insert: string; cursor: number } {
  const selected = value.slice(start, end);
  const marker = snippet.indexOf("$");
  const insert = marker < 0 ? snippet : snippet.slice(0, marker) + selected + snippet.slice(marker + 1);
  const offset = marker < 0 ? insert.length : marker + selected.length;
  return { value: value.slice(0, start) + insert + value.slice(end), insert, cursor: start + offset };
}
