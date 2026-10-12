import type { SerializedStyles } from "@emotion/react";
import { css } from "@emotion/react";

import { JSONBlock } from "@phoenix/components/code/JSONBlock";
import { Text } from "@phoenix/components/core/content";
import { usePrettyText } from "@phoenix/hooks/usePrettyText";
import { assertUnreachable } from "@phoenix/typeUtils";

type PrettyTextProps = {
  children: string;
  /**
   * Compact read-only text for explanations and inline errors. Plain prose uses
   * body typography; JSON uses mono text without an editor surface or controls.
   * Existing code-oriented callers keep the default presentation.
   * @default "code"
   */
  variant?: "code" | "compact";
  /**
   * Style overrides for the pre tag
   */
  preCSS?: SerializedStyles;
};

export function PrettyText({
  children,
  preCSS,
  variant = "code",
}: PrettyTextProps) {
  const { text, textType } = usePrettyText(children);
  if (variant === "compact") {
    return (
      <Text
        className="pretty-text pretty-text--compact"
        color="inherit"
        fontFamily={textType === "json" ? "mono" : "default"}
        css={css`
          display: block;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        `}
      >
        {text}
      </Text>
    );
  }
  if (textType === "string") {
    return (
      <pre
        css={css`
          white-space: pre-wrap;
          text-wrap: wrap;
          overflow-wrap: anywhere;
          font-size: var(--global-font-size-s);
          margin: 0;
          ${preCSS}
        `}
      >
        {text}
      </pre>
    );
  }
  if (textType === "json") {
    return <JSONBlock value={text} />;
  }
  return assertUnreachable(textType);
}
