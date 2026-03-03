import { css } from "@emotion/react";
import { isTextUIPart, type UIMessage } from "ai";
import { Streamdown } from "streamdown";

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
  max-width: 90%;
`;

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

export function AssistantMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div css={assistantMessageCSS}>
      {parts.map((part, i) =>
        isTextUIPart(part) ? <Streamdown key={i}>{part.text}</Streamdown> : null
      )}
    </div>
  );
}
