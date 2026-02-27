import type { PluginDataEnvelope } from "@repo/core";

export const DATA_VERSION = 1;

export type TemplatePluginData = PluginDataEnvelope<{
  sampleText: string;
}>;

export const DEFAULT_DATA: TemplatePluginData = {
  version: DATA_VERSION,
  sampleText: "Hello from template-plugin"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrateData(raw: unknown): TemplatePluginData {
  if (!isRecord(raw)) {
    return DEFAULT_DATA;
  }

  const incomingVersion = typeof raw.version === "number" ? raw.version : 0;
  const legacyText = typeof raw.text === "string" ? raw.text : undefined;
  const sampleText =
    typeof raw.sampleText === "string"
      ? raw.sampleText
      : legacyText ?? DEFAULT_DATA.sampleText;

  if (incomingVersion < DATA_VERSION) {
    return {
      version: DATA_VERSION,
      sampleText
    };
  }

  return {
    version: DATA_VERSION,
    sampleText
  };
}

