import { Plugin } from "obsidian";

import { createDataStore } from "./data-store";
import type { DataStore, PluginDataEnvelope } from "./types";

export abstract class ObsidianPluginBase<
  TData extends PluginDataEnvelope<Record<string, unknown>>
> extends Plugin {
  protected abstract readonly defaults: TData;
  private store!: DataStore<TData>;

  protected migrateData(raw: unknown): TData {
    if (typeof raw !== "object" || raw === null) {
      return this.defaults;
    }

    return {
      ...this.defaults,
      ...(raw as TData)
    };
  }

  protected abstract onPluginReady(): Promise<void> | void;

  protected onPluginDispose(): Promise<void> | void {}

  protected get data(): TData {
    return this.store.get();
  }

  protected async setData(next: TData): Promise<void> {
    await this.store.set(next);
  }

  protected async patchData(next: Partial<TData>): Promise<void> {
    await this.store.patch(next);
  }

  override async onload(): Promise<void> {
    this.store = createDataStore(this, this.defaults, (raw) => this.migrateData(raw));
    await this.store.reload();
    await this.onPluginReady();
  }

  override async onunload(): Promise<void> {
    await this.onPluginDispose();
  }
}

