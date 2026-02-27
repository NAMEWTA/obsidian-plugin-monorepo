import { ObsidianPluginBase } from "@repo/core";
import { App, Notice } from "obsidian";

import {
  DATA_VERSION,
  DEFAULT_DATA,
  migrateData,
  type TemplatePluginData
} from "./data/schema";
import { TemplatePluginSettingTab } from "./settings/SettingTab";

interface AppWithSettings extends App {
  setting: {
    open: () => void;
    openTabById: (id: string) => void;
  };
}

export default class TemplatePlugin extends ObsidianPluginBase<TemplatePluginData> {
  protected readonly defaults: TemplatePluginData = DEFAULT_DATA;

  protected override migrateData(raw: unknown): TemplatePluginData {
    return migrateData(raw);
  }

  protected override async onPluginReady(): Promise<void> {
    this.addSettingTab(new TemplatePluginSettingTab(this.app, this));

    this.addCommand({
      id: "template-plugin-open-settings",
      name: "Open template plugin settings",
      callback: () => {
        const appWithSettings = this.app as AppWithSettings;
        appWithSettings.setting.open();
        appWithSettings.setting.openTabById(this.manifest.id);
      }
    });

    this.addCommand({
      id: "template-plugin-show-text",
      name: "Show saved template text",
      callback: () => {
        new Notice(`Template text: ${this.data.sampleText}`);
      }
    });
  }

  async updateTemplateText(sampleText: string): Promise<void> {
    await this.patchData({
      version: DATA_VERSION,
      sampleText
    });
    new Notice("Template plugin setting saved.");
  }

  getTemplateText(): string {
    return this.data.sampleText;
  }
}
