import type { Plugin } from "obsidian";

import type { DataMigrator, DataStore } from "./types";

type PersistablePlugin = Pick<Plugin, "loadData" | "saveData">;

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSnapshot<TData extends Record<string, unknown>>(
  defaults: TData,
  raw: unknown
): TData {
  if (!isObject(raw)) {
    return clone(defaults);
  }

  return {
    ...clone(defaults),
    ...raw
  };
}

export function createDataStore<TData extends Record<string, unknown>>(
  plugin: PersistablePlugin,
  defaults: TData,
  migrate?: DataMigrator<TData>
): DataStore<TData> {
  let snapshot = clone(defaults);

  const persist = async (next: TData): Promise<void> => {
    snapshot = clone(next);
    await plugin.saveData(snapshot);
  };

  return {
    get() {
      return clone(snapshot);
    },
    async set(next) {
      await persist(normalizeSnapshot(defaults, next));
    },
    async patch(next) {
      await persist({
        ...snapshot,
        ...next
      });
    },
    async reload() {
      const raw = await plugin.loadData();
      snapshot = migrate
        ? normalizeSnapshot(defaults, migrate(raw))
        : normalizeSnapshot(defaults, raw);
      return clone(snapshot);
    }
  };
}

