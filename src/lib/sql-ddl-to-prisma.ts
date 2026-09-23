/**
 * SQLのDDL（CREATE TABLE など）を解析し、schema.prisma のモデル定義に変換する。
 * PostgreSQL・MySQL・SQLite でよく使われる構文に対応する。
 */

export type PrismaProvider = "postgresql" | "mysql" | "sqlite" | "sqlserver";

export type DdlConvertOptions = {
  provider: PrismaProvider;
  /** テーブル名・カラム名をPrismaの命名規則（PascalCase / camelCase）に変換し、@map で元の名前を残す */
  renameToConvention: boolean;
  /** @db.VarChar(255) などのネイティブ型属性を出力する */
  nativeTypes: boolean;
  /** generator / datasource ブロックを出力する */
  includeHeader: boolean;
};

export type DdlConvertResult = {
  schema: string;
  modelCount: number;
  enumCount: number;
  /** 解釈できずに読み飛ばした文の先頭部分 */
  skipped: string[];
  warnings: DdlWarning[];
};

export type DdlWarning =
  | { type: "no-primary-key"; table: string }
  | { type: "unknown-reference"; table: string; target: string }
  | { type: "unsupported-type"; table: string; column: string; sqlType: string };

// ---------------------------------------------------------------------------
// 字句解析
// ---------------------------------------------------------------------------

type Token =
  | { kind: "word"; value: string; upper: string }
  | { kind: "quoted"; value: string }
  | { kind: "string"; value: string }
  | { kind: "number"; value: string }
  | { kind: "punct"; value: string };

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "#") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (ch === "'") {
      let value = "";
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          value += "'";
          i += 2;
        } else if (sql[i] === "\\" && i + 1 < sql.length) {
          value += sql[i + 1];
          i += 2;
        } else if (sql[i] === "'") {
          i += 1;
          break;
        } else {
          value += sql[i];
          i += 1;
        }
      }
      tokens.push({ kind: "string", value });
      continue;
    }
    // "[" はSQL Serverの識別子の囲みだが、"text[]" や "int[3]" のような配列型は記号として扱う
    if (ch === '"' || ch === "`" || (ch === "[" && !/[\]0-9]/.test(sql[i + 1] ?? ""))) {
      const close = ch === "[" ? "]" : ch;
      const end = sql.indexOf(close, i + 1);
      const value = sql.slice(i + 1, end === -1 ? sql.length : end);
      tokens.push({ kind: "quoted", value });
      i = end === -1 ? sql.length : end + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(sql[i + 1] ?? "") && /[\s(,=]/.test(sql[i - 1] ?? " "))) {
      let end = i + 1;
      while (end < sql.length && /[0-9.eE]/.test(sql[end])) end += 1;
      tokens.push({ kind: "number", value: sql.slice(i, end) });
      i = end;
      continue;
    }
    if (/[A-Za-z_$\u0080-\uffff]/.test(ch)) {
      let end = i + 1;
      while (end < sql.length && /[A-Za-z0-9_$\u0080-\uffff]/.test(sql[end])) end += 1;
      const value = sql.slice(i, end);
      tokens.push({ kind: "word", value, upper: value.toUpperCase() });
      i = end;
      continue;
    }
    if (ch === ":" && sql[i + 1] === ":") {
      tokens.push({ kind: "punct", value: "::" });
      i += 2;
      continue;
    }
    tokens.push({ kind: "punct", value: ch });
    i += 1;
  }
  return tokens;
}

function splitStatements(tokens: Token[]): Token[][] {
  const statements: Token[][] = [];
  let current: Token[] = [];
  for (const token of tokens) {
    if (token.kind === "punct" && token.value === ";") {
      if (current.length) statements.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length) statements.push(current);
  return statements;
}

class Cursor {
  index = 0;
  constructor(public tokens: Token[]) {}

  peek(offset = 0): Token | undefined {
    return this.tokens[this.index + offset];
  }

  next(): Token | undefined {
    return this.tokens[this.index++];
  }

  isWord(...words: string[]): boolean {
    const token = this.peek();
    return token?.kind === "word" && words.includes(token.upper);
  }

  acceptWord(...words: string[]): boolean {
    if (this.isWord(...words)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  acceptWords(...words: string[]): boolean {
    for (let i = 0; i < words.length; i += 1) {
      const token = this.peek(i);
      if (token?.kind !== "word" || token.upper !== words[i]) return false;
    }
    this.index += words.length;
    return true;
  }

  isPunct(value: string): boolean {
    const token = this.peek();
    return token?.kind === "punct" && token.value === value;
  }

  acceptPunct(value: string): boolean {
    if (this.isPunct(value)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  get done(): boolean {
    return this.index >= this.tokens.length;
  }

  /** 識別子（schema.table 形式の場合は最後の要素）を読む */
  readName(): string | null {
    let name = this.readIdentifier();
    if (name === null) return null;
    while (this.isPunct(".")) {
      this.index += 1;
      const part = this.readIdentifier();
      if (part === null) break;
      name = part;
    }
    return name;
  }

  readIdentifier(): string | null {
    const token = this.peek();
    if (token?.kind === "word" || token?.kind === "quoted") {
      this.index += 1;
      return token.value;
    }
    return null;
  }

  /** 対応する閉じ括弧までのトークンを読み、括弧の中身を返す（現在位置は "(" の想定） */
  readParenthesized(): Token[] {
    if (!this.acceptPunct("(")) return [];
    const start = this.index;
    let depth = 1;
    while (!this.done) {
      const token = this.next()!;
      if (token.kind === "punct" && token.value === "(") depth += 1;
      if (token.kind === "punct" && token.value === ")") {
        depth -= 1;
        if (depth === 0) return this.tokens.slice(start, this.index - 1);
      }
    }
    return this.tokens.slice(start);
  }

  readNameList(): string[] {
    const inner = new Cursor(this.readParenthesized());
    const names: string[] = [];
    while (!inner.done) {
      const name = inner.readIdentifier();
      if (name !== null) names.push(name);
      // 長さ指定（col(10)）や ASC/DESC を読み飛ばす
      while (!inner.done && !inner.isPunct(",")) {
        if (inner.isPunct("(")) inner.readParenthesized();
        else inner.next();
      }
      inner.acceptPunct(",");
    }
    return names;
  }
}

function splitTopLevel(tokens: Token[]): Token[][] {
  const parts: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.kind === "punct" && token.value === "(") depth += 1;
    if (token.kind === "punct" && token.value === ")") depth -= 1;
    if (depth === 0 && token.kind === "punct" && token.value === ",") {
      parts.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length) parts.push(current);
  return parts;
}

function tokensToSql(tokens: Token[]): string {
  let text = "";
  tokens.forEach((token, index) => {
    const value =
      token.kind === "string"
        ? `'${token.value.replace(/'/g, "''")}'`
        : token.kind === "quoted"
          ? `"${token.value}"`
          : token.value;
    const previous = tokens[index - 1];
    const noSpaceBefore =
      (token.kind === "punct" && [")", ",", ".", "::"].includes(token.value)) ||
      (token.kind === "punct" && token.value === "(" && previous?.kind === "word");
    const previousIsOpen = text.endsWith("(") || text.endsWith(".") || text.endsWith("::");
    text += text && !noSpaceBefore && !previousIsOpen ? ` ${value}` : value;
  });
  return text;
}

// ---------------------------------------------------------------------------
// 構文解析
// ---------------------------------------------------------------------------

type ForeignKey = {
  columns: string[];
  table: string;
  references: string[];
  onDelete?: string;
  onUpdate?: string;
};

type Column = {
  name: string;
  sqlType: string;
  typeArgs: string[];
  isArray: boolean;
  unsigned: boolean;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  onUpdateNow: boolean;
  defaultTokens: Token[] | null;
  enumValues: string[] | null;
};

type Table = {
  name: string;
  columns: Column[];
  primaryKey: string[];
  uniques: string[][];
  indexes: string[][];
  foreignKeys: ForeignKey[];
};

const REFERENTIAL_ACTIONS: Record<string, string> = {
  CASCADE: "Cascade",
  RESTRICT: "Restrict",
  "NO ACTION": "NoAction",
  "SET NULL": "SetNull",
  "SET DEFAULT": "SetDefault",
};

function readReferentialAction(cursor: Cursor): string | undefined {
  for (const action of ["SET NULL", "SET DEFAULT", "NO ACTION", "CASCADE", "RESTRICT"]) {
    if (cursor.acceptWords(...action.split(" "))) return REFERENTIAL_ACTIONS[action];
  }
  return undefined;
}

function readReferences(cursor: Cursor, columns: string[]): ForeignKey | null {
  const table = cursor.readName();
  if (!table) return null;
  const references = cursor.isPunct("(") ? cursor.readNameList() : [];
  const foreignKey: ForeignKey = { columns, table, references };
  while (!cursor.done) {
    if (cursor.acceptWords("ON", "DELETE")) foreignKey.onDelete = readReferentialAction(cursor);
    else if (cursor.acceptWords("ON", "UPDATE")) foreignKey.onUpdate = readReferentialAction(cursor);
    else if (cursor.acceptWord("MATCH")) cursor.next();
    else if (cursor.acceptWord("DEFERRABLE", "INITIALLY", "DEFERRED", "IMMEDIATE") || cursor.acceptWords("NOT", "DEFERRABLE")) continue;
    else break;
  }
  return foreignKey;
}

const TYPE_CONTINUATIONS: Record<string, string[]> = {
  DOUBLE: ["PRECISION"],
  CHARACTER: ["VARYING"],
  BIT: ["VARYING"],
  TIMESTAMP: ["WITH", "WITHOUT"],
  TIME: ["WITH", "WITHOUT"],
};

function parseColumn(tokens: Token[], table: Table): void {
  const cursor = new Cursor(tokens);
  const name = cursor.readIdentifier();
  if (name === null) return;

  const typeToken = cursor.next();
  let sqlType = typeToken && (typeToken.kind === "word" || typeToken.kind === "quoted") ? typeToken.value.toUpperCase() : "TEXT";
  // "DOUBLE PRECISION" や "TIMESTAMP WITH TIME ZONE" のような複数語の型
  const continuations = TYPE_CONTINUATIONS[sqlType];
  if (continuations && cursor.isWord(...continuations)) {
    if (cursor.acceptWords("WITH", "TIME", "ZONE")) sqlType = `${sqlType} WITH TIME ZONE`;
    else if (!cursor.acceptWords("WITHOUT", "TIME", "ZONE")) {
      sqlType = `${sqlType} ${(cursor.next() as { upper: string }).upper}`;
    }
  }

  const column: Column = {
    name,
    sqlType,
    typeArgs: [],
    isArray: false,
    unsigned: false,
    nullable: true,
    primaryKey: false,
    unique: false,
    autoIncrement: false,
    onUpdateNow: false,
    defaultTokens: null,
    enumValues: null,
  };

  if (cursor.isPunct("(")) {
    const args = cursor.readParenthesized();
    if (sqlType === "ENUM" || sqlType === "SET") {
      column.enumValues = args.filter((token) => token.kind === "string").map((token) => token.value);
    } else {
      column.typeArgs = args.filter((token) => token.kind === "number" || token.kind === "word").map((token) => token.value);
    }
  }
  if (cursor.acceptWords("WITH", "TIME", "ZONE")) column.sqlType = `${column.sqlType} WITH TIME ZONE`;
  else cursor.acceptWords("WITHOUT", "TIME", "ZONE");
  while (cursor.isPunct("[")) {
    cursor.next();
    if (cursor.peek()?.kind === "number") cursor.next();
    cursor.acceptPunct("]");
    column.isArray = true;
  }
  if (cursor.acceptWord("ARRAY")) column.isArray = true;

  while (!cursor.done) {
    if (cursor.acceptWord("UNSIGNED")) column.unsigned = true;
    else if (cursor.acceptWord("ZEROFILL", "SIGNED", "BINARY")) continue;
    else if (cursor.acceptWords("NOT", "NULL")) column.nullable = false;
    else if (cursor.acceptWord("NULL")) column.nullable = true;
    else if (cursor.acceptWords("PRIMARY", "KEY")) {
      column.primaryKey = true;
      column.nullable = false;
      cursor.acceptWord("ASC", "DESC");
      if (cursor.acceptWord("AUTOINCREMENT")) column.autoIncrement = true;
    } else if (cursor.acceptWord("UNIQUE")) {
      cursor.acceptWord("KEY");
      column.unique = true;
    } else if (cursor.acceptWord("AUTO_INCREMENT", "AUTOINCREMENT", "IDENTITY")) {
      column.autoIncrement = true;
      if (cursor.isPunct("(")) cursor.readParenthesized();
    } else if (cursor.acceptWord("GENERATED")) {
      if (cursor.acceptWords("ALWAYS", "AS", "IDENTITY") || cursor.acceptWords("BY", "DEFAULT", "AS", "IDENTITY")) {
        column.autoIncrement = true;
        if (cursor.isPunct("(")) cursor.readParenthesized();
      } else {
        // 生成列（GENERATED ALWAYS AS (expr) STORED）は式を読み飛ばす
        cursor.acceptWord("ALWAYS");
        cursor.acceptWord("AS");
        if (cursor.isPunct("(")) cursor.readParenthesized();
        cursor.acceptWord("STORED", "VIRTUAL");
      }
    } else if (cursor.acceptWord("DEFAULT")) {
      const start = cursor.index;
      if (cursor.isPunct("(")) {
        cursor.readParenthesized();
      } else {
        cursor.next();
        if (cursor.isPunct("(")) cursor.readParenthesized();
      }
      while (cursor.isPunct("::")) {
        cursor.next();
        cursor.readName();
        if (cursor.isPunct("(")) cursor.readParenthesized();
      }
      column.defaultTokens = tokens.slice(start, cursor.index);
    } else if (cursor.acceptWords("ON", "UPDATE")) {
      const token = cursor.next();
      if (token?.kind === "word" && /^(CURRENT_TIMESTAMP|NOW)$/.test(token.upper)) column.onUpdateNow = true;
      if (cursor.isPunct("(")) cursor.readParenthesized();
    } else if (cursor.acceptWord("REFERENCES")) {
      const foreignKey = readReferences(cursor, [name]);
      if (foreignKey) table.foreignKeys.push(foreignKey);
    } else if (cursor.acceptWord("CONSTRAINT")) {
      cursor.readIdentifier();
    } else if (cursor.acceptWord("CHECK")) {
      cursor.readParenthesized();
    } else if (cursor.acceptWord("COMMENT", "COLLATE", "CHARACTER", "CHARSET")) {
      cursor.acceptWord("SET");
      cursor.next();
    } else {
      cursor.next();
    }
  }

  if (/^(SMALLSERIAL|SERIAL|BIGSERIAL|SERIAL2|SERIAL4|SERIAL8)$/.test(column.sqlType)) {
    column.autoIncrement = true;
    column.nullable = false;
  }
  table.columns.push(column);
}

function parseTableConstraint(tokens: Token[], table: Table): boolean {
  const cursor = new Cursor(tokens);
  if (cursor.acceptWord("CONSTRAINT")) cursor.readIdentifier();

  if (cursor.acceptWords("PRIMARY", "KEY")) {
    table.primaryKey = cursor.readNameList();
    return true;
  }
  if (cursor.acceptWord("UNIQUE")) {
    cursor.acceptWord("KEY", "INDEX");
    if (!cursor.isPunct("(")) cursor.readIdentifier();
    table.uniques.push(cursor.readNameList());
    return true;
  }
  if (cursor.acceptWords("FOREIGN", "KEY")) {
    if (!cursor.isPunct("(")) cursor.readIdentifier();
    const columns = cursor.readNameList();
    if (cursor.acceptWord("REFERENCES")) {
      const foreignKey = readReferences(cursor, columns);
      if (foreignKey) table.foreignKeys.push(foreignKey);
    }
    return true;
  }
  if (cursor.isWord("KEY", "INDEX", "FULLTEXT", "SPATIAL")) {
    cursor.next();
    cursor.acceptWord("KEY", "INDEX");
    if (!cursor.isPunct("(")) cursor.readIdentifier();
    table.indexes.push(cursor.readNameList());
    return true;
  }
  if (cursor.acceptWord("CHECK", "EXCLUDE")) return true;
  return false;
}

type ParsedDdl = {
  tables: Table[];
  enums: Map<string, string[]>;
  skipped: string[];
};

function parseDdl(sql: string): ParsedDdl {
  const tables: Table[] = [];
  const enums = new Map<string, string[]>();
  const skipped: string[] = [];
  const pendingForeignKeys: { table: string; foreignKey: ForeignKey }[] = [];
  const pendingIndexes: { table: string; columns: string[]; unique: boolean }[] = [];
  const pendingPrimaryKeys: { table: string; columns: string[] }[] = [];

  for (const statement of splitStatements(tokenize(sql))) {
    const cursor = new Cursor(statement);

    if (cursor.acceptWord("CREATE")) {
      cursor.acceptWords("OR", "REPLACE");
      cursor.acceptWord("TEMPORARY", "TEMP", "UNLOGGED");

      if (cursor.acceptWord("TABLE")) {
        cursor.acceptWords("IF", "NOT", "EXISTS");
        const name = cursor.readName();
        if (!name || !cursor.isPunct("(")) {
          skipped.push(tokensToSql(statement).slice(0, 60));
          continue;
        }
        const table: Table = { name, columns: [], primaryKey: [], uniques: [], indexes: [], foreignKeys: [] };
        for (const part of splitTopLevel(cursor.readParenthesized())) {
          if (part.length === 0) continue;
          if (!parseTableConstraint(part, table)) parseColumn(part, table);
        }
        tables.push(table);
        continue;
      }

      if (cursor.acceptWord("TYPE")) {
        const name = cursor.readName();
        if (name && cursor.acceptWords("AS", "ENUM")) {
          enums.set(
            name,
            cursor.readParenthesized().filter((token) => token.kind === "string").map((token) => token.value)
          );
          continue;
        }
      }

      const unique = cursor.acceptWord("UNIQUE");
      cursor.acceptWord("CLUSTERED", "NONCLUSTERED");
      if (cursor.acceptWord("INDEX")) {
        cursor.acceptWord("CONCURRENTLY");
        cursor.acceptWords("IF", "NOT", "EXISTS");
        if (!cursor.isWord("ON")) cursor.readName();
        if (cursor.acceptWord("ON")) {
          cursor.acceptWord("ONLY");
          const table = cursor.readName();
          if (cursor.acceptWord("USING")) cursor.next();
          if (table && cursor.isPunct("(")) {
            pendingIndexes.push({ table, columns: cursor.readNameList(), unique });
            continue;
          }
        }
      }
    }

    // ALTER TABLE ... ADD [CONSTRAINT x] FOREIGN KEY / PRIMARY KEY / UNIQUE
    cursor.index = 0;
    if (cursor.acceptWords("ALTER", "TABLE")) {
      cursor.acceptWord("ONLY");
      cursor.acceptWords("IF", "EXISTS");
      const tableName = cursor.readName();
      let handled = false;
      while (tableName && cursor.acceptWord("ADD")) {
        const rest: Token[] = [];
        let depth = 0;
        while (!cursor.done) {
          const token = cursor.peek()!;
          if (token.kind === "punct" && token.value === "(") depth += 1;
          if (token.kind === "punct" && token.value === ")") depth -= 1;
          if (depth === 0 && token.kind === "punct" && token.value === ",") {
            cursor.next();
            break;
          }
          rest.push(cursor.next()!);
        }
        const holder: Table = { name: tableName, columns: [], primaryKey: [], uniques: [], indexes: [], foreignKeys: [] };
        if (parseTableConstraint(rest, holder)) {
          handled = true;
          for (const foreignKey of holder.foreignKeys) pendingForeignKeys.push({ table: tableName, foreignKey });
          if (holder.primaryKey.length) pendingPrimaryKeys.push({ table: tableName, columns: holder.primaryKey });
          for (const columns of holder.uniques) pendingIndexes.push({ table: tableName, columns, unique: true });
        }
      }
      if (handled) continue;
    }

    const head = tokensToSql(statement.slice(0, 8));
    if (!/^(SET|USE|BEGIN|COMMIT|START|DROP|LOCK|UNLOCK|SELECT|INSERT|COMMENT|GRANT|REVOKE|ALTER SEQUENCE|CREATE SEQUENCE|CREATE EXTENSION|CREATE SCHEMA|CREATE DATABASE)\b/i.test(head)) {
      skipped.push(`${tokensToSql(statement).slice(0, 60)}…`);
    }
  }

  const tableMap = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  for (const { table, foreignKey } of pendingForeignKeys) {
    tableMap.get(table.toLowerCase())?.foreignKeys.push(foreignKey);
  }
  // pg_dump のように ALTER TABLE で後から追加された主キー・一意制約・インデックスを反映する
  for (const { table, columns } of pendingPrimaryKeys) {
    const target = tableMap.get(table.toLowerCase());
    if (target && target.primaryKey.length === 0 && !target.columns.some((column) => column.primaryKey)) {
      target.primaryKey = columns;
    }
  }
  for (const { table, columns, unique } of pendingIndexes) {
    const target = tableMap.get(table.toLowerCase());
    if (!target) continue;
    if (unique) target.uniques.push(columns);
    else target.indexes.push(columns);
  }

  return { tables, enums, skipped };
}

// ---------------------------------------------------------------------------
// Prismaスキーマの生成
// ---------------------------------------------------------------------------

function toPascalCase(value: string): string {
  const parts = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts
    .map((part) => (part === part.toUpperCase() ? part.charAt(0) + part.slice(1).toLowerCase() : part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return /^[0-9]/.test(joined) ? `_${joined}` : joined || "_";
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function sanitizeIdentifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

type PrismaType = {
  type: string;
  native?: string;
  unsupported?: boolean;
};

function mapType(column: Column, options: DdlConvertOptions, enumName: string | null): PrismaType {
  if (enumName) return { type: enumName };
  const type = column.sqlType.replace(/^"|"$/g, "");
  const args = column.typeArgs;
  const pg = options.provider === "postgresql";
  const mysql = options.provider === "mysql";

  switch (type) {
    case "SERIAL":
    case "SERIAL4":
    case "INT":
    case "INTEGER":
    case "INT4":
    case "MEDIUMINT":
      return { type: "Int", native: mysql && type === "MEDIUMINT" ? "MediumInt" : mysql && column.unsigned ? "UnsignedInt" : undefined };
    case "SMALLSERIAL":
    case "SERIAL2":
    case "SMALLINT":
    case "INT2":
      return { type: "Int", native: pg || mysql ? "SmallInt" : undefined };
    case "TINYINT":
      if (mysql && args[0] === "1") return { type: "Boolean" };
      return { type: "Int", native: mysql ? "TinyInt" : undefined };
    case "BIGSERIAL":
    case "SERIAL8":
    case "BIGINT":
    case "INT8":
      return { type: "BigInt" };
    case "BOOLEAN":
    case "BOOL":
    case "BIT":
      return { type: "Boolean" };
    case "DECIMAL":
    case "NUMERIC":
    case "MONEY":
      return { type: "Decimal", native: args.length && (pg || mysql) ? `Decimal(${args.join(", ")})` : undefined };
    case "REAL":
    case "FLOAT4":
      return { type: "Float", native: pg ? "Real" : undefined };
    case "FLOAT":
    case "FLOAT8":
    case "DOUBLE":
    case "DOUBLE PRECISION":
      return { type: "Float" };
    case "VARCHAR":
    case "CHARACTER VARYING":
    case "NVARCHAR":
    case "VARCHAR2":
      return { type: "String", native: args.length && (pg || mysql) ? `VarChar(${args[0]})` : undefined };
    case "CHAR":
    case "CHARACTER":
    case "NCHAR":
    case "BPCHAR":
      return { type: "String", native: (pg || mysql) ? `Char(${args[0] ?? 1})` : undefined };
    case "TEXT":
    case "CLOB":
    case "CITEXT":
      return { type: "String", native: (pg || mysql) && type === "TEXT" ? "Text" : pg && type === "CITEXT" ? "Citext" : undefined };
    case "TINYTEXT":
    case "MEDIUMTEXT":
    case "LONGTEXT":
      return { type: "String", native: mysql ? `${type.charAt(0)}${type.slice(1).toLowerCase().replace("text", "Text")}` : undefined };
    case "UUID":
    case "UNIQUEIDENTIFIER":
      return { type: "String", native: pg ? "Uuid" : undefined };
    case "DATE":
      return { type: "DateTime", native: pg || mysql ? "Date" : undefined };
    case "TIME":
    case "TIME WITH TIME ZONE":
      return { type: "DateTime", native: pg ? (type === "TIME" ? "Time" : "Timetz") : mysql ? "Time" : undefined };
    case "TIMESTAMPTZ":
    case "TIMESTAMP WITH TIME ZONE":
      return { type: "DateTime", native: pg ? "Timestamptz" : undefined };
    case "TIMESTAMP":
    case "DATETIME":
    case "DATETIME2":
    case "SMALLDATETIME":
      return { type: "DateTime", native: mysql && type === "TIMESTAMP" ? "Timestamp" : undefined };
    case "JSON":
    case "JSONB":
      return { type: "Json", native: pg && type === "JSON" ? "Json" : undefined };
    case "BYTEA":
    case "BLOB":
    case "TINYBLOB":
    case "MEDIUMBLOB":
    case "LONGBLOB":
    case "BINARY":
    case "VARBINARY":
    case "IMAGE":
      return { type: "Bytes" };
    default:
      return { type: `Unsupported("${column.sqlType.toLowerCase()}")`, unsupported: true };
  }
}

function formatDefault(column: Column, prismaType: string, enumValues: string[] | null): string | null {
  if (column.autoIncrement) return "autoincrement()";
  const tokens = column.defaultTokens;
  if (!tokens || tokens.length === 0) return null;
  const first = tokens[0];
  const raw = tokensToSql(tokens);
  const upperRaw = raw.toUpperCase();

  if (/^(CURRENT_TIMESTAMP|NOW\s*\(|LOCALTIMESTAMP|GETDATE\s*\(|SYSDATETIME)/.test(upperRaw)) return "now()";
  if (/^NEXTVAL\s*\(/.test(upperRaw)) return "autoincrement()";
  if (/^(GEN_RANDOM_UUID|UUID_GENERATE_V4|UUID|NEWID)\s*\(/.test(upperRaw)) return "dbgenerated(\"" + raw.replace(/"/g, '\\"') + "\")";
  if (first.kind === "word" && first.upper === "NULL") return null;

  if (first.kind === "string") {
    if (enumValues && enumValues.includes(first.value)) return sanitizeIdentifier(first.value);
    if (prismaType === "Boolean") return /^(1|t|true|y|yes)$/i.test(first.value) ? "true" : "false";
    if (["Int", "BigInt", "Float", "Decimal"].includes(prismaType) && /^-?\d+(\.\d+)?$/.test(first.value)) return first.value;
    if (prismaType === "String") return JSON.stringify(first.value);
    return `dbgenerated("${raw.replace(/"/g, '\\"')}")`;
  }
  if (first.kind === "number") {
    if (prismaType === "Boolean") return first.value === "0" ? "false" : "true";
    if (tokens.length === 1) return first.value;
  }
  if (first.kind === "word" && (first.upper === "TRUE" || first.upper === "FALSE") && tokens.length === 1) {
    return first.upper.toLowerCase();
  }
  if (first.kind === "punct" && first.value === "(" && tokens.length >= 3 && tokens[1].kind === "number") {
    return tokens[1].value;
  }
  return `dbgenerated("${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

type FieldLine = { name: string; type: string; attributes: string[] };

function renderBlock(header: string, lines: FieldLine[], blockAttributes: string[], comments: string[]): string {
  const nameWidth = Math.max(0, ...lines.map((line) => line.name.length));
  const typeWidth = Math.max(0, ...lines.map((line) => line.type.length));
  const body = lines.map((line) =>
    `  ${line.name.padEnd(nameWidth)} ${line.attributes.length ? line.type.padEnd(typeWidth) + " " + line.attributes.join(" ") : line.type}`.trimEnd()
  );
  const attributeLines = blockAttributes.map((attribute) => `  ${attribute}`);
  return [
    ...comments,
    `${header} {`,
    ...body,
    ...(attributeLines.length ? ["", ...attributeLines] : []),
    "}",
  ].join("\n");
}

export function convertDdlToPrisma(sql: string, options: DdlConvertOptions): DdlConvertResult {
  const { tables, enums, skipped } = parseDdl(sql);
  const warnings: DdlWarning[] = [];
  const nativeEnabled = options.nativeTypes && (options.provider === "postgresql" || options.provider === "mysql");

  const modelName = (table: Table) => (options.renameToConvention ? toPascalCase(table.name) : sanitizeIdentifier(table.name));
  const fieldName = (column: string) => (options.renameToConvention ? toCamelCase(column) : sanitizeIdentifier(column));

  // enumの名前を確定する（PostgreSQLのCREATE TYPEと、MySQLのENUM列）
  const enumBlocks = new Map<string, { sqlName: string | null; values: string[] }>();
  const enumNameBySql = new Map<string, string>();
  for (const [sqlName, values] of enums) {
    const name = options.renameToConvention ? toPascalCase(sqlName) : sanitizeIdentifier(sqlName);
    enumBlocks.set(name, { sqlName, values });
    enumNameBySql.set(sqlName.toUpperCase(), name);
  }
  const columnEnum = new Map<Column, string>();
  for (const table of tables) {
    for (const column of table.columns) {
      const existing = enumNameBySql.get(column.sqlType.toUpperCase());
      if (existing) {
        columnEnum.set(column, existing);
      } else if (column.enumValues) {
        let name = `${toPascalCase(table.name)}${toPascalCase(column.name)}`;
        while (enumBlocks.has(name)) name += "_";
        enumBlocks.set(name, { sqlName: null, values: column.enumValues });
        columnEnum.set(column, name);
      }
    }
  }

  const tableByName = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  const models = new Map<Table, { lines: FieldLine[]; blockAttributes: string[]; comments: string[] }>();

  // スカラーフィールド
  for (const table of tables) {
    const lines: FieldLine[] = [];
    const blockAttributes: string[] = [];
    const comments: string[] = [];
    const primaryKey = table.primaryKey.length
      ? table.primaryKey
      : table.columns.filter((column) => column.primaryKey).map((column) => column.name);
    const singleUniques = new Set(
      table.uniques.filter((columns) => columns.length === 1).map((columns) => columns[0])
    );

    for (const column of table.columns) {
      const enumName = columnEnum.get(column) ?? null;
      const mapped = mapType(column, options, enumName);
      if (mapped.unsupported) {
        warnings.push({ type: "unsupported-type", table: table.name, column: column.name, sqlType: column.sqlType.toLowerCase() });
      }
      const isPrimary = primaryKey.length === 1 && primaryKey[0] === column.name;
      const optional = column.nullable && !isPrimary && !primaryKey.includes(column.name);
      let type = mapped.type;
      if (column.isArray && !mapped.unsupported) type += "[]";
      else if (optional) type += "?";

      const attributes: string[] = [];
      if (isPrimary) attributes.push("@id");
      if (!isPrimary && (column.unique || singleUniques.has(column.name))) attributes.push("@unique");
      const enumValues = enumName ? enumBlocks.get(enumName)?.values ?? null : null;
      const defaultValue = formatDefault(column, mapped.type, enumValues);
      if (defaultValue !== null && !column.isArray) attributes.push(`@default(${defaultValue})`);
      if (column.onUpdateNow) attributes.push("@updatedAt");
      const name = fieldName(column.name);
      if (name !== column.name) attributes.push(`@map("${column.name}")`);
      if (nativeEnabled && mapped.native) attributes.push(`@db.${mapped.native}`);
      lines.push({ name, type, attributes });
    }

    if (primaryKey.length > 1) {
      blockAttributes.push(`@@id([${primaryKey.map(fieldName).join(", ")}])`);
    }
    for (const columns of table.uniques) {
      if (columns.length > 1) blockAttributes.push(`@@unique([${columns.map(fieldName).join(", ")}])`);
    }
    for (const columns of table.indexes) {
      if (columns.length > 0) blockAttributes.push(`@@index([${columns.map(fieldName).join(", ")}])`);
    }
    if (modelName(table) !== table.name) blockAttributes.push(`@@map("${table.name}")`);

    if (primaryKey.length === 0 && !table.columns.some((column) => column.unique) && !table.uniques.length) {
      warnings.push({ type: "no-primary-key", table: table.name });
      comments.push("/// 主キーまたは一意制約がないため、Prisma Clientで利用するには @id か @unique の追加が必要です");
      blockAttributes.push("@@ignore");
    }
    models.set(table, { lines, blockAttributes, comments });
  }

  // リレーションフィールド
  const pairCounts = new Map<string, number>();
  for (const table of tables) {
    for (const foreignKey of table.foreignKeys) {
      const key = [table.name, foreignKey.table].map((name) => name.toLowerCase()).sort().join("\u0000");
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
  }

  for (const table of tables) {
    const model = models.get(table)!;
    for (const foreignKey of table.foreignKeys) {
      const target = tableByName.get(foreignKey.table.toLowerCase());
      if (!target) {
        warnings.push({ type: "unknown-reference", table: table.name, target: foreignKey.table });
        continue;
      }
      const targetModel = models.get(target)!;
      const references = foreignKey.references.length
        ? foreignKey.references
        : target.primaryKey.length
          ? target.primaryKey
          : target.columns.filter((column) => column.primaryKey).map((column) => column.name);
      if (references.length !== foreignKey.columns.length) continue;

      const pairKey = [table.name, foreignKey.table].map((name) => name.toLowerCase()).sort().join("\u0000");
      const needsName = (pairCounts.get(pairKey) ?? 0) > 1 || target === table;
      const relationName = needsName ? `${modelName(table)}_${foreignKey.columns.map(fieldName).join("_")}` : null;

      const usedNames = new Set(model.lines.map((line) => line.name));
      const baseName =
        foreignKey.columns.length === 1 && /_?id$/i.test(foreignKey.columns[0]) && foreignKey.columns[0].length > 2
          ? toCamelCase(foreignKey.columns[0].replace(/_?id$/i, ""))
          : toCamelCase(modelName(target));
      let relationField = baseName;
      while (usedNames.has(relationField)) relationField += "Relation";

      const optional = foreignKey.columns.some((name) => table.columns.find((column) => column.name === name)?.nullable);
      const args = [
        ...(relationName ? [`"${relationName}"`] : []),
        `fields: [${foreignKey.columns.map(fieldName).join(", ")}]`,
        `references: [${references.map(fieldName).join(", ")}]`,
        ...(foreignKey.onDelete ? [`onDelete: ${foreignKey.onDelete}`] : []),
        ...(foreignKey.onUpdate ? [`onUpdate: ${foreignKey.onUpdate}`] : []),
      ];
      model.lines.push({
        name: relationField,
        type: `${modelName(target)}${optional ? "?" : ""}`,
        attributes: [`@relation(${args.join(", ")})`],
      });

      // 参照される側の逆方向リレーション
      const isOneToOne =
        foreignKey.columns.length === 1 &&
        (table.columns.find((column) => column.name === foreignKey.columns[0])?.unique ||
          table.uniques.some((columns) => columns.length === 1 && columns[0] === foreignKey.columns[0]));
      const targetUsed = new Set(targetModel.lines.map((line) => line.name));
      const sourceName = toCamelCase(modelName(table));
      let backName = isOneToOne || /s$/i.test(sourceName) ? sourceName : `${sourceName}s`;
      if (needsName) backName = `${backName}${toPascalCase(foreignKey.columns.join("_"))}`;
      while (targetUsed.has(backName)) backName += "Relation";
      targetModel.lines.push({
        name: backName,
        type: `${modelName(table)}${isOneToOne ? "?" : "[]"}`,
        attributes: relationName ? [`@relation("${relationName}")`] : [],
      });
    }
  }

  const blocks: string[] = [];
  if (options.includeHeader) {
    blocks.push('generator client {\n  provider = "prisma-client-js"\n}');
    blocks.push(`datasource db {\n  provider = "${options.provider}"\n  url      = env("DATABASE_URL")\n}`);
  }
  for (const table of tables) {
    const model = models.get(table)!;
    blocks.push(renderBlock(`model ${modelName(table)}`, model.lines, model.blockAttributes, model.comments));
  }
  for (const [name, { sqlName, values }] of enumBlocks) {
    const lines: FieldLine[] = values.map((value) => {
      const identifier = sanitizeIdentifier(value);
      return { name: identifier, type: identifier === value ? "" : `@map("${value}")`, attributes: [] };
    });
    const body = lines.map((line) => `  ${line.name}${line.type ? ` ${line.type}` : ""}`);
    const mapLine = sqlName && sqlName !== name ? ["", `  @@map("${sqlName}")`] : [];
    blocks.push([`enum ${name} {`, ...body, ...mapLine, "}"].join("\n"));
  }

  return {
    schema: blocks.length ? `${blocks.join("\n\n")}\n` : "",
    modelCount: tables.length,
    enumCount: enumBlocks.size,
    skipped,
    warnings,
  };
}
