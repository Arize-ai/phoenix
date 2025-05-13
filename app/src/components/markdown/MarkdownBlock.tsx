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
}: {
  children: string;
  mode: MarkdownDisplayMode;
}) {
  return mode === "markdown" ? (
    <div css={markdownCSS}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        css={css`
          margin: var(--ac-global-dimension-static-size-200);
        `}
      >
        {children}
      </Markdown>
    </div>
  ) : (
    <PrettyText
      preCSS={css`
        margin: var(--ac-global-dimension-static-size-200);
      `}
    >
      {children}
    </PrettyText>
  );
}

export function ConnectedMarkdownBlock({ children }: { children: string }) {
  const { mode } = useMarkdownMode();
  return <MarkdownBlock mode={mode}>{children}</MarkdownBlock>;
}
