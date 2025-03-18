import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PrettyText } from "../utility";

import { useMarkdownMode } from "./MarkdownDisplayContext";
import { markdownCSS } from "./styles";
import { MarkdownDisplayMode } from "./types";

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
    <PrettyText>{children}</PrettyText>
  );
}

export function ConnectedMarkdownBlock({ children }: { children: string }) {
  const { mode } = useMarkdownMode();
  return <MarkdownBlock mode={mode}>{children}</MarkdownBlock>;
}
