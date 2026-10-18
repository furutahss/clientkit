/** npm形式のバージョン範囲に候補バージョンが含まれるかを判定する（レジストリには問い合わせない） */
import { Range, satisfies, valid } from "semver";

export type RangeCheck =
  | { status: "empty" }
  /** Git URL・tarball・ローカルパスなど、レジストリのバージョン範囲ではない指定 */
  | { status: "nonRegistry" }
  /** latest や next などのdist-tag */
  | { status: "tag" }
  | { status: "invalid" }
  | { status: "valid"; normalized: string };

const NON_REGISTRY = /^(git\+|git:|github:|gitlab:|bitbucket:|gist:|https?:|file:|link:|workspace:|npm:|\.{0,2}\/|~\/)/i;
const GITHUB_SHORTHAND = /^[\w.-]+\/[\w.-]+(#.*)?$/;
const TAG = /^[A-Za-z][\w.-]*$/;

export function checkRange(text: string): RangeCheck {
  const value = text.trim();
  if (value === "") return { status: "empty" };
  if (NON_REGISTRY.test(value) || GITHUB_SHORTHAND.test(value) || /\.(tgz|tar\.gz)$/i.test(value)) {
    return { status: "nonRegistry" };
  }
  try {
    return { status: "valid", normalized: new Range(value).range || "*" };
  } catch {
    return TAG.test(value) ? { status: "tag" } : { status: "invalid" };
  }
}

export type CandidateResult =
  | { input: string; status: "invalid" }
  | {
      input: string;
      status: "match" | "noMatch";
      version: string;
      /** プレリリースを含める設定にした場合だけ範囲に含まれる */
      prereleaseExcluded: boolean;
    };

export function checkCandidates(range: string, candidates: string[], includePrerelease: boolean): CandidateResult[] {
  return candidates
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((input) => {
      const version = valid(input);
      if (!version) return { input, status: "invalid" };
      const match = satisfies(version, range, { includePrerelease });
      return {
        input,
        status: match ? "match" : "noMatch",
        version,
        prereleaseExcluded: !match && !includePrerelease && satisfies(version, range, { includePrerelease: true }),
      };
    });
}
