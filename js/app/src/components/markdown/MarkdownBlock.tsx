import { css } from "@emotion/react";
import { code } from "@streamdown/code";
import {
  type AnimateOptions,
  type IconMap,
  type PluginConfig,
  Streamdown,
} from "streamdown";

import { Icons } from "../core/icon";
import { PrettyText } from "../utility";
import { useMarkdownMode } from "./MarkdownDisplayContext";
import { streamdownComponents } from "./streamdownComponents";
import { markdownCSS } from "./styles";
import type { MarkdownDisplayMode } from "./types";

import "streamdown/styles.css";

// Cast needed because @streamdown/code compiles against shiki v3 types while
// streamdown's published .d.ts references a different shiki resolution. The
// runtime interface is identical.
const plugins: PluginConfig = {
  code: code as unknown as PluginConfig["code"],
};

const streamingAnimation: AnimateOptions = {
  animation: "fadeIn",
  duration: 120,
  easing: "ease-out",
  sep: "word",
  stagger: 0,
  maxBacklogMs: 96,
};

// ---------------------------------------------------------------------------
// Icon overrides — match streamdown's code-block action icons to Phoenix's
// icon set so they look consistent with the table toolbar controls.
// Streamdown's IconComponent type expects (props: SVGProps & {size?}) but
// Phoenix icons are zero-prop components. CSS in styles.ts handles sizing,
// so the size prop can be safely ignored.
// ---------------------------------------------------------------------------

const streamdownIcons: Partial<IconMap> = {
  CopyIcon: () => <Icons.Duplicate />,
  CheckIcon: () => <Icons.Checkmark />,
  DownloadIcon: () => <Icons.Download />,
};

export function MarkdownBlock({
  children,
  mode,
  renderMode = "static",
  isAnimating = false,
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
  /** Animates only content appended while the markdown stream is active. */
  isAnimating?: boolean;
  margin?: "default" | "none";
}) {
  const spacingCSS =
    margin === "none"
      ? css`
          margin: 0;
        `
      : css`
          margin: var(--global-dimension-size-200);
        `;

  return mode === "markdown" ? (
    <div css={[markdownCSS, spacingCSS]}>
      <Streamdown
        animated={streamingAnimation}
        // Streamdown otherwise caps code at 400px and auto-scrolls that nested
        // viewport while tokens arrive. Let code grow so the transcript remains
        // the only vertical scroll owner and its streaming follower can advance.
        codeBlockMaxHeight={0}
        components={streamdownComponents}
        controls={{ code: { copy: true, download: true }, table: false }}
        icons={streamdownIcons}
        isAnimating={isAnimating}
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
  isAnimating,
  margin = "default",
}: {
  children: string;
  renderMode?: "static" | "streaming";
  isAnimating?: boolean;
  margin?: "default" | "none";
}) {
  const { mode } = useMarkdownMode();
  return (
    <MarkdownBlock
      mode={mode}
      renderMode={renderMode}
      isAnimating={isAnimating}
      margin={margin}
    >
      {children}
    </MarkdownBlock>
  );
}
