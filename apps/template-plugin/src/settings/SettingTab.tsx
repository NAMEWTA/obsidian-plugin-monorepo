import { App, PluginSettingTab } from "obsidian";

import type TemplatePlugin from "../main";
import { mountTemplateApp } from "../react/mount";

export class TemplatePluginSettingTab extends PluginSettingTab {
  private unmount: (() => void) | undefined;

  constructor(app: App, private readonly plugin: TemplatePlugin) {
    super(app, plugin);
  }

  override display(): void {
    this.unmount?.();

    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Template Plugin Settings" });

    const mountEl = containerEl.createDiv({
      cls: "template-plugin-settings-root"
    });

    this.unmount = mountTemplateApp(mountEl, {
      value: this.plugin.getTemplateText(),
      onSave: async (next) => {
        await this.plugin.updateTemplateText(next);
      }
    });
  }

  override hide(): void {
    this.unmount?.();
    this.unmount = undefined;
  }
}

