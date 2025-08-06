import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { css } from "@emotion/react";

import { PrettyText } from "../utility";

import { useMarkdownMode } from "./MarkdownDisplayContext";
import { markdownCSS } from "./styles";
import { MarkdownDisplayMode } from "./types";

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
          margin: var(--ac-global-dimension-static-size-200);
        `;

  return mode === "markdown" ? (
    <div css={markdownCSS}>
      <Markdown remarkPlugins={[remarkGfm]} css={spacingCSS}>
        {children}
      </Markdown>
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
