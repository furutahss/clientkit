/** 再現可能なダミーデータ生成（シード付き乱数）。日本語・英語の氏名・住所・電話番号など */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const JP = {
  last: [["佐藤", "Sato"], ["鈴木", "Suzuki"], ["高橋", "Takahashi"], ["田中", "Tanaka"], ["伊藤", "Ito"], ["渡辺", "Watanabe"], ["山本", "Yamamoto"], ["中村", "Nakamura"], ["小林", "Kobayashi"], ["加藤", "Kato"], ["吉田", "Yoshida"], ["山田", "Yamada"], ["佐々木", "Sasaki"], ["松本", "Matsumoto"], ["井上", "Inoue"], ["木村", "Kimura"], ["林", "Hayashi"], ["清水", "Shimizu"], ["山崎", "Yamazaki"], ["森", "Mori"]],
  first: [["太郎", "Taro"], ["健太", "Kenta"], ["大輔", "Daisuke"], ["翔太", "Shota"], ["拓也", "Takuya"], ["花子", "Hanako"], ["美咲", "Misaki"], ["陽子", "Yoko"], ["愛", "Ai"], ["さくら", "Sakura"], ["優太", "Yuta"], ["結衣", "Yui"], ["蓮", "Ren"], ["葵", "Aoi"], ["彩", "Aya"]],
  places: [["北海道", "札幌市中央区", "060"], ["宮城県", "仙台市青葉区", "980"], ["東京都", "千代田区", "100"], ["東京都", "渋谷区", "150"], ["神奈川県", "横浜市西区", "220"], ["愛知県", "名古屋市中区", "460"], ["大阪府", "大阪市北区", "530"], ["京都府", "京都市中京区", "604"], ["兵庫県", "神戸市中央区", "650"], ["福岡県", "福岡市博多区", "812"]],
  companies: ["株式会社サンプル", "有限会社テスト商事", "合同会社ダミー技研", "株式会社デモ", "テスト工業株式会社"],
};
const EN = {
  last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Martin", "Lee"],
  first: ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Susan", "Emma", "Liam", "Olivia"],
  places: [["CA", "San Francisco", "94105"], ["NY", "New York", "10001"], ["TX", "Austin", "73301"], ["WA", "Seattle", "98101"], ["IL", "Chicago", "60601"], ["MA", "Boston", "02108"]],
  streets: ["Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Park Rd"],
  companies: ["Acme Corp", "Globex Inc", "Initech LLC", "Umbrella Ltd", "Hooli Co"],
};

export type Locale = "ja" | "en";
export type Field = string; // 例: name, email, int:1-100, pick:a|b|c

export const FIELD_NAMES = ["name", "first_name", "last_name", "email", "phone", "postal_code", "address", "company", "birthday", "uuid", "bool", "id", "date", "int:1-100", "float:0-1", "pick:a|b|c"];

export function generateRows(fields: Field[], count: number, seed: number, locale: Locale): Record<string, string | number | boolean>[] {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const int = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join("");
  const hex = (n: number) => Array.from({ length: n }, () => int(0, 15).toString(16)).join("");
  const rows: Record<string, string | number | boolean>[] = [];
  for (let i = 0; i < count; i++) {
    const person = locale === "ja" ? { last: pick(JP.last), first: pick(JP.first) } : { last: [pick(EN.last)], first: [pick(EN.first)] };
    const row: Record<string, string | number | boolean> = {};
    const place = locale === "ja" ? pick(JP.places) : pick(EN.places);
    for (const f of fields) {
      const [kind, arg = ""] = f.split(":");
      const roman = (locale === "ja" ? [person.last[1], person.first[1]] : [person.last[0], person.first[0]]).join(".").toLowerCase();
      switch (kind) {
        case "name": row[f] = locale === "ja" ? `${person.last[0]} ${person.first[0]}` : `${person.first[0]} ${person.last[0]}`; break;
        case "first_name": row[f] = person.first[0]; break;
        case "last_name": row[f] = person.last[0]; break;
        case "email": row[f] = `${roman}${int(1, 99)}@example.com`; break;
        case "phone": row[f] = locale === "ja" ? `0${pick(["90", "80", "70"])}-${digits(4)}-${digits(4)}` : `+1-555-${digits(3)}-${digits(4)}`; break;
        case "postal_code": row[f] = locale === "ja" ? `${place[2]}-${digits(4)}` : `${place[2]}`; break;
        case "address": row[f] = locale === "ja" ? `${place[0]}${place[1]}${int(1, 9)}-${int(1, 30)}-${int(1, 20)}` : `${int(1, 9999)} ${pick(EN.streets)}, ${place[1]}, ${place[0]} ${place[2]}`; break;
        case "company": row[f] = pick(locale === "ja" ? JP.companies : EN.companies); break;
        case "birthday": row[f] = `${int(1950, 2005)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`; break;
        case "date": row[f] = `${int(2020, 2026)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`; break;
        case "uuid": row[f] = `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(["8", "9", "a", "b"])}${hex(3)}-${hex(12)}`; break;
        case "bool": row[f] = r() < 0.5; break;
        case "id": row[f] = i + 1; break;
        case "int": { const [a, b] = arg.split("-").map(Number); row[f] = int(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 100); break; }
        case "float": { const [a, b] = arg.split("-").map(Number); const lo = Number.isFinite(a) ? a : 0, hi = Number.isFinite(b) ? b : 1; row[f] = Math.round((lo + r() * (hi - lo)) * 100) / 100; break; }
        case "pick": { const options = arg.split("|").filter(Boolean); row[f] = options.length ? pick(options) : ""; break; }
        default: row[f] = "?";
      }
    }
    rows.push(row);
  }
  return rows;
}

const colName = (f: string) => f.replace(/[:|-].*$/, "") + (/^(int|float|pick)/.test(f) ? "_" + f.split(":")[0] : "");

export function renderRows(rows: Record<string, string | number | boolean>[], fields: Field[], format: "csv" | "tsv" | "json" | "ndjson" | "sql", table = "users"): string {
  const cols = fields.map((f, i) => { const base = colName(f); return fields.findIndex((x, j) => j < i && colName(x) === base) >= 0 ? `${base}_${i + 1}` : base; });
  const values = rows.map((row) => fields.map((f) => row[f]));
  const esc = (v: string | number | boolean, sep: string) => { const s = String(v); return new RegExp(`[${sep}"\\n]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  switch (format) {
    case "csv": return [cols.join(","), ...values.map((v) => v.map((x) => esc(x, ",")).join(","))].join("\n");
    case "tsv": return [cols.join("\t"), ...values.map((v) => v.map((x) => String(x).replace(/[\t\n]/g, " ")).join("\t"))].join("\n");
    case "json": return JSON.stringify(values.map((v) => Object.fromEntries(cols.map((c, i) => [c, v[i]]))), null, 2);
    case "ndjson": return values.map((v) => JSON.stringify(Object.fromEntries(cols.map((c, i) => [c, v[i]])))).join("\n");
    case "sql": return values.length ? `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${values.map((v) => `  (${v.map((x) => (typeof x === "number" ? x : typeof x === "boolean" ? (x ? "TRUE" : "FALSE") : `'${String(x).replace(/'/g, "''")}'`)).join(", ")})`).join(",\n")};` : "";
  }
}
