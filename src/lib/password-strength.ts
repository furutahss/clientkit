export type PasswordIssue = "short" | "common" | "repeated" | "sequence" | "lowVariety";

export function checkPasswordStrength(password: string) {
  const characters = Array.from(password);
  const length = characters.length;
  const issues: PasswordIssue[] = [];
  if (!length) return { score: 0, length, issues };

  const normalized = password.normalize("NFKC").toLowerCase();
  const simplified = normalized.replace(/[@430!1$5]/g, (char) => ({
    "@": "a", "4": "a", "3": "e", "0": "o", "!": "i", "1": "i", "$": "s", "5": "s",
  })[char]!);
  if (length < 16) issues.push("short");
  // shortcut: 小さな単語リストによる簡易判定。辞書攻撃の精密な評価が必要になったら専用推定器に置き換える。
  if (["password", "qwerty", "letmein", "welcome", "admin", "iloveyou", "changeme"].some(
    (word) => simplified.includes(word),
  )) issues.push("common");
  if (/^(\s+|(.{1,32})\2+)$/su.test(password)) issues.push("repeated");
  const sequences = ["abcdefghijklmnopqrstuvwxyz", "01234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  if (sequences.some((sequence) => {
    const reversed = Array.from(sequence).reverse().join("");
    return Array.from({ length: sequence.length - 3 }, (_, i) => sequence.slice(i, i + 4))
      .some((part) => normalized.includes(part)) ||
      Array.from({ length: reversed.length - 3 }, (_, i) => reversed.slice(i, i + 4))
        .some((part) => normalized.includes(part));
  })) issues.push("sequence");
  if (new Set(characters).size < 5) issues.push("lowVariety");

  let score = length < 8 ? 1 : length < 12 ? 2 : length < 16 ? 3 : 4;
  if (issues.some((issue) => issue !== "short")) score = 1;
  return { score, length, issues };
}
