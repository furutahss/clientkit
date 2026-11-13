/** 2つの CREATE TABLE 群を比較して、ALTER 文を生成する（PostgreSQL / MySQL / 汎用） */
export type Column = { name: string; def: string; type: string; notNull: boolean; default: string | null };
export type Table = { name: string; columns: Column[]; constraints: { key: string; sql: string }[]; create: string };
export type Dialect = "postgres" | "mysql";

function splitTop(src: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = "", cur = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) { cur += c; if (c === quote) quote = ""; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; cur += c; continue; }
    if (c === "-" && src[i + 1] === "-") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === sep && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

const unq = (s: string) => s.replace(/^[`"[]|[`"\]]$/g, "");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseSchema(sql: string): Table[] {
  const tables: Table[] = [];
  for (const stmt of splitTop(sql, ";")) {
    const m = /^create\s+(?:temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?([`"\w.[\]]+)\s*\(([\s\S]*)\)\s*[^)]*$/i.exec(stmt);
    if (!m) continue;
    const table: Table = { name: m[1].split(".").map(unq).join("."), columns: [], constraints: [], create: stmt.trim() + ";" };
    for (const item of splitTop(m[2], ",")) {
      const d = norm(item);
      if (/^(constraint|primary\s+key|unique(\s+(key|index))?|key|index|foreign\s+key|check|fulltext|spatial)\b/i.test(d)) {
        const name = /^constraint\s+([`"\w]+)/i.exec(d)?.[1] ?? /^(?:unique\s+)?(?:key|index)\s+([`"\w]+)/i.exec(d)?.[1];
        table.constraints.push({ key: name ? unq(name).toLowerCase() : d.toLowerCase(), sql: d });
        continue;
      }
      const cm = /^([`"\w]+)\s+([\s\S]+)$/.exec(d);
      if (!cm) continue;
      const rest = cm[2];
      const typeMatch = /^([a-z]+(?:\s+(?:varying|precision|unsigned|zerofill))*(?:\s*\([^)]*\))?(?:\s+(?:with|without)\s+time\s+zone)?(?:\[\])?)/i.exec(rest);
      const def = /\bdefault\s+((?:'(?:[^']|'')*'|\([^)]*\)|[^\s,]+(?:\([^)]*\))?))/i.exec(rest);
      table.columns.push({ name: unq(cm[1]), def: d, type: norm(typeMatch?.[1] ?? "").toLowerCase().replace(/^integer$/, "int"), notNull: /\bnot\s+null\b/i.test(rest) || /\bprimary\s+key\b/i.test(rest), default: def ? def[1] : null });
    }
    tables.push(table);
  }
  return tables;
}

const q = (s: string, d: Dialect) => (d === "mysql" ? `\`${s}\`` : /^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s}"`);

export function diffSchemas(oldSql: string, newSql: string, dialect: Dialect): { statements: string[]; summary: string[] } {
  const a = new Map(parseSchema(oldSql).map((t) => [t.name.toLowerCase(), t]));
  const b = new Map(parseSchema(newSql).map((t) => [t.name.toLowerCase(), t]));
  const out: string[] = [], summary: string[] = [];
  for (const [key, t] of b) if (!a.has(key)) { out.push(t.create); summary.push(`+ table ${t.name}`); }
  for (const [key, t] of a) if (!b.has(key)) { out.push(`DROP TABLE ${q(t.name, dialect)};`); summary.push(`- table ${t.name}`); }
  for (const [key, nt] of b) {
    const ot = a.get(key);
    if (!ot) continue;
    const T = q(nt.name, dialect);
    const oc = new Map(ot.columns.map((c) => [c.name.toLowerCase(), c])), nc = new Map(nt.columns.map((c) => [c.name.toLowerCase(), c]));
    for (const [k, c] of nc) {
      const o = oc.get(k);
      if (!o) { out.push(`ALTER TABLE ${T} ADD COLUMN ${c.def};`); summary.push(`+ column ${nt.name}.${c.name}`); continue; }
      if (norm(o.def).toLowerCase() === norm(c.def).toLowerCase()) continue;
      if (dialect === "mysql") { out.push(`ALTER TABLE ${T} MODIFY COLUMN ${c.def};`); summary.push(`~ column ${nt.name}.${c.name}`); continue; }
      const col = q(c.name, dialect);
      if (o.type !== c.type) out.push(`ALTER TABLE ${T} ALTER COLUMN ${col} TYPE ${c.type};`);
      if (o.notNull !== c.notNull) out.push(`ALTER TABLE ${T} ALTER COLUMN ${col} ${c.notNull ? "SET" : "DROP"} NOT NULL;`);
      if ((o.default ?? "") !== (c.default ?? "")) out.push(c.default === null ? `ALTER TABLE ${T} ALTER COLUMN ${col} DROP DEFAULT;` : `ALTER TABLE ${T} ALTER COLUMN ${col} SET DEFAULT ${c.default};`);
      summary.push(`~ column ${nt.name}.${c.name}`);
    }
    for (const [k, c] of oc) if (!nc.has(k)) { out.push(`ALTER TABLE ${T} DROP COLUMN ${q(c.name, dialect)};`); summary.push(`- column ${nt.name}.${c.name}`); }
    const ocs = new Map(ot.constraints.map((c) => [c.key, c])), ncs = new Map(nt.constraints.map((c) => [c.key, c]));
    for (const [k, c] of ncs) {
      const o = ocs.get(k);
      if (o && norm(o.sql).toLowerCase() === norm(c.sql).toLowerCase()) continue;
      if (o) out.push(dropConstraint(T, o.sql, k, dialect));
      out.push(addConstraint(T, c.sql, dialect));
      summary.push(`${o ? "~" : "+"} constraint ${nt.name}: ${c.sql.slice(0, 50)}`);
    }
    for (const [k, c] of ocs) if (!ncs.has(k)) { out.push(dropConstraint(T, c.sql, k, dialect)); summary.push(`- constraint ${nt.name}: ${c.sql.slice(0, 50)}`); }
  }
  return { statements: out, summary };
}

function addConstraint(T: string, sql: string, d: Dialect): string {
  if (d === "mysql" && /^(unique\s+)?(key|index)\b/i.test(sql)) return `ALTER TABLE ${T} ADD ${sql};`;
  if (d === "postgres" && /^(unique\s+)?(key|index)\s+/i.test(sql)) { const m = /^(unique\s+)?(?:key|index)\s+(\S+)\s*(\([^)]*\))/i.exec(sql); if (m) return `CREATE ${m[1] ? "UNIQUE " : ""}INDEX ${m[2]} ON ${T} ${m[3]};`; }
  return `ALTER TABLE ${T} ADD ${sql};`;
}

function dropConstraint(T: string, sql: string, key: string, d: Dialect): string {
  if (/^primary\s+key/i.test(sql)) return d === "mysql" ? `ALTER TABLE ${T} DROP PRIMARY KEY;` : `ALTER TABLE ${T} DROP CONSTRAINT ${T.replace(/"/g, "")}_pkey;`;
  const name = /^constraint\s+([`"\w]+)/i.exec(sql)?.[1] ?? (/^(?:unique\s+)?(?:key|index)\s+([`"\w]+)/i.exec(sql)?.[1]);
  if (!name) return `-- TODO: unnamed constraint cannot be dropped automatically: ${sql}`;
  if (d === "mysql") return /^constraint/i.test(sql) ? `ALTER TABLE ${T} DROP ${/foreign/i.test(sql) ? "FOREIGN KEY" : /unique/i.test(sql) ? "INDEX" : "CHECK"} ${name};` : `ALTER TABLE ${T} DROP INDEX ${name};`;
  return /^constraint/i.test(sql) ? `ALTER TABLE ${T} DROP CONSTRAINT ${name};` : `DROP INDEX ${name};`;
}
