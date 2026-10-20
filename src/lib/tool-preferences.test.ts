import { beforeEach, describe, expect, it, vi } from "vitest";

const key = "clientkit:tool-preferences";
let saved: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  saved = new Map();
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      localStorage: {
        getItem: (name: string) => saved.get(name) ?? null,
        setItem: (name: string, value: string) => saved.set(name, value),
      },
    }),
  );
});

describe("お気に入り・履歴", () => {
  it("保存したお気に入りが再読み込み後も残り、再操作で外せる", async () => {
    let store = await import("./tool-preferences");
    store.toggleFavorite("json-formatter");
    vi.resetModules();
    store = await import("./tool-preferences");
    expect(store.getToolPreferences().favorites).toEqual(["json-formatter"]);
    store.toggleFavorite("json-formatter");
    expect(store.getToolPreferences().favorites).toEqual([]);
  });

  it("履歴は重複なしの新しい順で直近5件まで", async () => {
    const store = await import("./tool-preferences");
    [
      "base64",
      "ocr",
      "pdf-toolkit",
      "id-generator",
      "text-diff",
      "json-formatter",
      "ocr",
    ].forEach(store.recordRecentTool);
    expect(store.getToolPreferences().recent).toEqual([
      "ocr",
      "json-formatter",
      "text-diff",
      "id-generator",
      "pdf-toolkit",
    ]);
    store.clearRecentTools();
    expect(store.getToolPreferences().recent).toEqual([]);
  });

  it("保存データの未知のID、不正な型、重複を除外する", async () => {
    saved.set(
      key,
      JSON.stringify({
        favorites: ["missing", 7, "base64", "base64"],
        recent: "ocr",
      }),
    );
    const store = await import("./tool-preferences");
    expect(store.getToolPreferences()).toEqual({
      favorites: ["base64"],
      recent: [],
    });
    store.toggleFavorite("missing");
    store.recordRecentTool("missing");
    expect(store.getToolPreferences()).toEqual({
      favorites: ["base64"],
      recent: [],
    });
  });

  it.each(["{broken", "null", "[]"])(
    "壊れた保存データ %s でも使える",
    async (raw) => {
      saved.set(key, raw);
      const store = await import("./tool-preferences");
      expect(store.getToolPreferences()).toEqual({ favorites: [], recent: [] });
    },
  );

  it("ストレージが使えなくても、その画面内では操作できる", async () => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("storage blocked");
      },
    });
    const store = await import("./tool-preferences");
    store.toggleFavorite("base64");
    store.recordRecentTool("ocr");
    expect(store.getToolPreferences()).toEqual({
      favorites: ["base64"],
      recent: ["ocr"],
    });
  });

  it("別タブで保存・削除された内容を反映する", async () => {
    const store = await import("./tool-preferences");
    const unsubscribe = store.subscribeToolPreferences(() => {});
    window.dispatchEvent(
      Object.assign(new Event("storage"), {
        key,
        newValue: '{"favorites":["ocr"],"recent":[]}',
      }),
    );
    expect(store.getToolPreferences().favorites).toEqual(["ocr"]);
    window.dispatchEvent(
      Object.assign(new Event("storage"), { key: null, newValue: null }),
    );
    expect(store.getToolPreferences().favorites).toEqual([]);
    unsubscribe();
  });
});
