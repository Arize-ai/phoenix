import { css } from "@emotion/react";
import { code } from "@streamdown/code";
import { type IconMap, type PluginConfig, Streamdown } from "streamdown";

import { Icons } from "../core/icon";
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

// ---------------------------------------------------------------------------
// Icon overrides — match streamdown's code-block action icons to Phoenix's
// icon set so they look consistent with the table toolbar controls.
// Streamdown's IconComponent type expects (props: SVGProps & {size?}) but
// Phoenix icons are zero-prop components. CSS in styles.ts handles sizing,
// so the size prop can be safely ignored.
// ---------------------------------------------------------------------------

const streamdownIcons: Partial<IconMap> = {
  CopyIcon: () => <Icons.DuplicateOutline />,
  CheckIcon: () => <Icons.CheckmarkOutline />,
  DownloadIcon: () => <Icons.DownloadOutline />,
};

export function MarkdownBlock({
  children,
  mode,
  renderMode = "static",
  margin = "default",
}: {
  children: string;
  mode: MarkdownDisplayMode;
  /**
   * Controls how Streamdown parses the markdown content.
   * - `"static"`: parses the full content at once (default, use for complete content)
   * - `"streaming"`: parses incrementally per-block with memoization (use when
   *   content is being actively streamed/appended)
   */
  renderMode?: "static" | "streaming";
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
        icons={streamdownIcons}
        mode={renderMode}
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
  renderMode,
  margin = "default",
}: {
  children: string;
  renderMode?: "static" | "streaming";
  margin?: "default" | "none";
}) {
  const { mode } = useMarkdownMode();
  return (
    <MarkdownBlock mode={mode} renderMode={renderMode} margin={margin}>
      {children}
    </MarkdownBlock>
  );
}
