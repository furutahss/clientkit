import { describe, expect, it } from "vitest";

import { diffSchemas, parseSchema } from "./sql-schema-diff";

const oldSql = `
CREATE TABLE users (
  id integer PRIMARY KEY,
  name varchar(50) NOT NULL,
  email varchar(100),
  age int DEFAULT 0,
  CONSTRAINT uq_email UNIQUE (email)
);
CREATE TABLE legacy (id int);
`;
const newSql = `
CREATE TABLE users (
  id integer PRIMARY KEY,
  name varchar(100) NOT NULL,
  email varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_email UNIQUE (email),
  INDEX idx_name (name)
);
CREATE TABLE posts (id int PRIMARY KEY, user_id int REFERENCES users(id));
`;

describe("スキーマ差分", () => {
  it("列・型・制約を解析する", () => {
    const [users] = parseSchema(oldSql);
    expect(users.columns.map((c) => [c.name, c.type, c.notNull, c.default])).toEqual([["id", "int", true, null], ["name", "varchar(50)", true, null], ["email", "varchar(100)", false, null], ["age", "int", false, "0"]]);
    expect(users.constraints[0].key).toBe("uq_email");
  });

  it("PostgreSQL 向けの ALTER 文を作る", () => {
    const { statements } = diffSchemas(oldSql, newSql, "postgres");
    expect(statements).toEqual([
      "CREATE TABLE posts (id int PRIMARY KEY, user_id int REFERENCES users(id));",
      "DROP TABLE legacy;",
      "ALTER TABLE users ALTER COLUMN name TYPE varchar(100);",
      "ALTER TABLE users ALTER COLUMN email SET NOT NULL;",
      "ALTER TABLE users ADD COLUMN created_at timestamp NOT NULL DEFAULT now();",
      "ALTER TABLE users DROP COLUMN age;",
      "CREATE INDEX idx_name ON users (name);",
    ]);
  });

  it("MySQL 向けは MODIFY COLUMN を使う", () => {
    const { statements, summary } = diffSchemas(oldSql, newSql, "mysql");
    expect(statements).toContain("ALTER TABLE `users` MODIFY COLUMN name varchar(100) NOT NULL;");
    expect(statements).toContain("ALTER TABLE `users` ADD INDEX idx_name (name);");
    expect(summary).toContain("- table legacy");
    expect(diffSchemas(oldSql, oldSql, "mysql").statements).toEqual([]);
  });
});
