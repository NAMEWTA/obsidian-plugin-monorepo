import { App as AntdApp, ConfigProvider } from "antd";
import type { ReactElement, ReactNode } from "react";

import { createThemeTokens, type ObsidianColorMode } from "./theme";

interface AntdObsidianProviderProps {
  readonly children: ReactNode;
  readonly mode?: ObsidianColorMode;
}

export function AntdObsidianProvider({
  children,
  mode = "light"
}: AntdObsidianProviderProps): ReactElement {
  return (
    <ConfigProvider theme={createThemeTokens(mode)}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
