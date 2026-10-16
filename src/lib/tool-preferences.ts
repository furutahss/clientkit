"use client";

import { useSyncExternalStore } from "react";
import { tools } from "@/config/tools";

type ToolPreferences = { favorites: string[]; recent: string[] };
const storageKey = "clientkit:tool-preferences";
const toolIds = new Set(tools.map((tool) => tool.id));
const empty: ToolPreferences = { favorites: [], recent: [] };
const listeners = new Set<() => void>();
let snapshot: ToolPreferences | undefined;

function parsePreferences(raw: string | null): ToolPreferences {
  try {
    const value = JSON.parse(raw ?? "null");
    const validIds = (ids: unknown): string[] =>
      Array.isArray(ids)
        ? [
            ...new Set(
              ids.filter(
                (id): id is string => typeof id === "string" && toolIds.has(id),
              ),
            ),
          ]
        : [];
    return {
      favorites: validIds(value?.favorites),
      recent: validIds(value?.recent).slice(0, 5),
    };
  } catch {
    return empty;
  }
}

export function getToolPreferences(): ToolPreferences {
  if (!snapshot) {
    try {
      snapshot = parsePreferences(window.localStorage.getItem(storageKey));
    } catch {
      snapshot = empty;
    }
  }
  return snapshot;
}

function savePreferences(next: ToolPreferences) {
  snapshot = next;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // 保存が拒否された場合も、このページを開いている間は使えるようにする。
  }
  listeners.forEach((listener) => listener());
}

export function toggleFavorite(id: string) {
  if (!toolIds.has(id)) return;
  const current = getToolPreferences();
  savePreferences({
    ...current,
    favorites: current.favorites.includes(id)
      ? current.favorites.filter((item) => item !== id)
      : [...current.favorites, id],
  });
}

export function recordRecentTool(id: string) {
  if (!toolIds.has(id)) return;
  const current = getToolPreferences();
  if (current.recent[0] === id) return;
  savePreferences({
    ...current,
    recent: [id, ...current.recent.filter((item) => item !== id)].slice(0, 5),
  });
}

export function clearRecentTools() {
  savePreferences({ ...getToolPreferences(), recent: [] });
}

export function subscribeToolPreferences(listener: () => void) {
  listeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) {
      snapshot = parsePreferences(event.newValue);
      listener();
    }
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useToolPreferences() {
  return useSyncExternalStore(
    subscribeToolPreferences,
    getToolPreferences,
    () => empty,
  );
}
