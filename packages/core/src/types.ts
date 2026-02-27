export type PluginDataEnvelope<T extends Record<string, unknown>> = T & {
  version: number;
};

export interface DataStore<TData extends Record<string, unknown>> {
  get(): TData;
  set(next: TData): Promise<void>;
  patch(next: Partial<TData>): Promise<void>;
  reload(): Promise<TData>;
}

export type DataMigrator<TData extends Record<string, unknown>> = (
  raw: unknown
) => TData;

