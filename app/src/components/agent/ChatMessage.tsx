import { css } from "@emotion/react";
import { isTextUIPart, type UIMessage } from "ai";
import { useMemo } from "react";

import { MarkdownBlock } from "@phoenix/components/markdown";

import { groupMessageParts } from "./groupMessageParts";
import { ToolPart } from "./ToolPart";
import { ToolPartGroup } from "./ToolPartGroup";

const userMessageCSS = css`
  align-self: flex-end;
  background-color: var(--global-color-primary-700);
  color: var(--global-color-gray-50);
  border-radius: var(--global-rounding-large) var(--global-rounding-large) 0
    var(--global-rounding-large);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  max-width: 75%;
  word-wrap: break-word;
`;

const assistantMessageCSS = css`
  align-self: flex-start;
  max-width: 100%;
  width: 100%;
`;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Renders a user message bubble (right-aligned, primary colour). */
export function UserMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div css={userMessageCSS}>
      {parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join("")}
    </div>
  );
}

/**
 * Renders an assistant message consisting of interleaved text and tool-call
 * parts. Consecutive runs of 3+ tool calls are collapsed into a
 * {@link ToolPartGroup} pool; shorter runs render individually as
 * {@link ToolPart} details.
 */
export function AssistantMessage({ parts }: { parts: UIMessage["parts"] }) {
  const grouped = useMemo(() => groupMessageParts(parts), [parts]);

  return (
    <div css={assistantMessageCSS}>
      {grouped.map((group) => {
        switch (group.kind) {
          case "text":
            return (
              <MarkdownBlock
                key={`text-${group.index}`}
                mode="markdown"
                renderMode="streaming"
                margin="none"
              >
                {group.part.type === "text" ? group.part.text : ""}
              </MarkdownBlock>
            );
          case "tool-solo":
            return <ToolPart key={`tool-${group.index}`} part={group.part} />;
          case "tool-group":
            return (
              <ToolPartGroup
                key={`pool-${group.startIndex}`}
                parts={group.parts}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
