import type { ThemeConfig } from "antd";

export type ObsidianColorMode = "light" | "dark";

export function detectObsidianMode(root: HTMLElement = document.body): ObsidianColorMode {
  return root.classList.contains("theme-dark") ? "dark" : "light";
}

export function createThemeTokens(mode: ObsidianColorMode): ThemeConfig {
  return {
    token: {
      colorBgContainer: "var(--background-primary)",
      colorBgElevated: "var(--background-secondary)",
      colorText: "var(--text-normal)",
      colorTextSecondary: "var(--text-muted)",
      colorPrimary: mode === "dark" ? "#4c9aff" : "#2f6feb",
      borderRadius: 8
    }
  };
}

