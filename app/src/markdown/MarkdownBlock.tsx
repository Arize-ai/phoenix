import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { css } from "@emotion/react";

import { useMarkdownMode } from "./MarkdownDisplayContext";
import { MarkdownDisplayMode } from "./types";

const markdownCSS = css`
  a {
    color: var(--ac-global-color-primary);
    &:visited {
      color: var(--ac-global-color-purple-900);
    }
  }
`;
export function MarkdownBlock({
  children,
  mode,
}: {
  children: string;
  mode: MarkdownDisplayMode;
}) {
  return mode === "markdown" ? (
    <div css={markdownCSS}>
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  ) : (
    <pre
      css={css`
        white-space: pre-wrap;
        text-wrap: wrap;
        margin: 0;
      `}
    >
      {children}
    </pre>
  );
}

export function ConnectedMarkdownBlock({ children }: { children: string }) {
  const { mode } = useMarkdownMode();
  return <MarkdownBlock mode={mode}>{children}</MarkdownBlock>;
}
