import { describe, expect, it } from "vitest";

import { formatGraphql, sdlToTypeScript } from "./graphql";

describe("GraphQL整形", () => {
  it("クエリを字下げして整形する", () => {
    const out = formatGraphql('query Q($id: ID!, $n: Int = 10) { user(id: $id) { name, friends(first: $n) { edges { node { id name } } } ...F @include(if: true) ... on Admin { level } } } fragment F on User { id }');
    expect(out).toBe(`query Q($id: ID!, $n: Int = 10) {
  user(id: $id) {
    name
    friends(first: $n) {
      edges {
        node {
          id
          name
        }
      }
    }
    ...F @include(if: true)
    ... on Admin {
      level
    }
  }
}
fragment F on User {
  id
}`);
  });

  it("SDLを整形する", () => {
    expect(formatGraphql("type User implements Node { id: ID! tags: [String!]! posts(first: Int): [Post] } enum Role { ADMIN USER }")).toBe(`type User implements Node {
  id: ID!
  tags: [String!]!
  posts(first: Int): [Post]
}
enum Role {
  ADMIN
  USER
}`);
  });

  it("不正な入力は例外にする", () => {
    expect(() => formatGraphql('query { a(b: "x) }')).toThrow(/unterminated/);
    expect(() => formatGraphql("query { a ? }")).toThrow(/unexpected character/);
  });
});

describe("SDL→TypeScript", () => {
  const sdl = `
    scalar DateTime
    """A user"""
    type User implements Node { id: ID! name: String age: Int tags: [String!]! posts(first: Int): [Post!] createdAt: DateTime! role: Role }
    interface Node { id: ID! }
    enum Role { ADMIN USER }
    union Result = User | Post
    type Post { title: String! }
    input NewUser { name: String! age: Int = 18 }
  `;
  it("型・Enum・Union・Inputを変換する", () => {
    const ts = sdlToTypeScript(sdl);
    expect(ts).toContain("export type DateTime = string;");
    expect(ts).toContain('export type Role = "ADMIN" | "USER";');
    expect(ts).toContain("export type Result = User | Post;");
    expect(ts).toContain("export interface User extends Node {");
    expect(ts).toContain("  name: string | null;");
    expect(ts).toContain("  tags: Array<string>;");
    expect(ts).toContain("  posts: Array<Post> | null;");
    expect(ts).toContain("  createdAt: DateTime;");
    expect(ts).toContain("  role: Role | null;");
    expect(ts).toContain("/** A user */");
    expect(ts).toContain("export interface NewUser {\n  name: string;\n  age?: number | null;\n}");
  });
  it("未定義の型を注記し、不正なSDLは例外にする", () => {
    expect(sdlToTypeScript("type A { b: B }")).toContain("Not defined in this SDL");
    expect(() => sdlToTypeScript("type A { b }")).toThrow(/expected ":"/);
    expect(() => sdlToTypeScript("query { a }")).toThrow(/unsupported definition/);
  });
});
