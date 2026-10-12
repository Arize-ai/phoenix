import type { SerializedStyles } from "@emotion/react";
import { css } from "@emotion/react";
import { useMemo } from "react";

import { JSONBlock } from "@phoenix/components/code/JSONBlock";
import { Text } from "@phoenix/components/core/content";
import { usePrettyText } from "@phoenix/hooks/usePrettyText";
import { assertUnreachable } from "@phoenix/typeUtils";
import { getJSONDisplayPreview } from "@phoenix/utils/getJSONDisplayPreview";

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
  return variant === "compact" ? (
    <CompactPrettyText>{children}</CompactPrettyText>
  ) : (
    <CodePrettyText preCSS={preCSS}>{children}</CodePrettyText>
  );
}

function CompactPrettyText({ children }: { children: string }) {
  const preview = useMemo(
    () => getJSONDisplayPreview({ text: children }),
    [children]
  );
  return (
    <>
      {preview.hasDecodedStrings ? (
        <Text
          className="pretty-text__preview-label"
          size="XS"
          color="inherit"
          css={css`
            display: block;
            padding-bottom: var(--global-dimension-size-50);
          `}
        >
          JSON preview · encoded strings decoded
        </Text>
      ) : null}
      <Text
        className="pretty-text pretty-text--compact"
        color="inherit"
        fontFamily={preview.textType === "json" ? "mono" : "default"}
        css={css`
          display: block;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        `}
      >
        {preview.text}
      </Text>
    </>
  );
}

function CodePrettyText({
  children,
  preCSS,
}: Omit<PrettyTextProps, "variant">) {
  const { text, textType } = usePrettyText(children);
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
