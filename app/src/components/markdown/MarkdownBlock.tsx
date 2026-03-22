import { css } from "@emotion/react";
import { code } from "@streamdown/code";
import { type PluginConfig, Streamdown } from "streamdown";

import { PrettyText } from "../utility";
import { useMarkdownMode } from "./MarkdownDisplayContext";
import { streamdownComponents } from "./streamdownComponents";
import { markdownCSS } from "./styles";
import type { MarkdownDisplayMode } from "./types";

// Cast needed because @streamdown/code compiles against shiki v3 types while
// streamdown's published .d.ts references a different shiki resolution. The
// runtime interface is identical.
const plugins: PluginConfig = {
  code: code as unknown as PluginConfig["code"],
};

export function MarkdownBlock({
  children,
  mode,
  margin = "default",
}: {
  children: string;
  mode: MarkdownDisplayMode;
  margin?: "default" | "none";
}) {
  const spacingCSS =
    margin === "none"
      ? css`
          margin: 0;
        `
      : css`
          margin: var(--global-dimension-static-size-200);
        `;

  return mode === "markdown" ? (
    <div css={[markdownCSS, spacingCSS]}>
      <Streamdown
        components={streamdownComponents}
        controls={{ code: { copy: true, download: true }, table: false }}
        linkSafety={{ enabled: false }}
        mode="static"
        plugins={plugins}
      >
        {children}
      </Streamdown>
    </div>
  ) : (
    <PrettyText preCSS={spacingCSS}>{children}</PrettyText>
  );
}

export function ConnectedMarkdownBlock({
  children,
  margin = "default",
}: {
  children: string;
  margin?: "default" | "none";
}) {
  const { mode } = useMarkdownMode();
  return (
    <MarkdownBlock mode={mode} margin={margin}>
      {children}
    </MarkdownBlock>
  );
}
