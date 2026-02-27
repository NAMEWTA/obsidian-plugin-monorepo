import { AntdObsidianProvider, detectObsidianMode } from "@repo/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TemplateApp, type TemplateAppProps } from "./App";

export function mountTemplateApp(container: HTMLElement, props: TemplateAppProps): () => void {
  const root = createRoot(container);

  root.render(
    <StrictMode>
      <AntdObsidianProvider mode={detectObsidianMode()}>
        <TemplateApp {...props} />
      </AntdObsidianProvider>
    </StrictMode>
  );

  return () => {
    root.unmount();
  };
}

