import { css, SerializedStyles } from "@emotion/react";

import { JSONBlock } from "@phoenix/components/code";
import { usePrettyText } from "@phoenix/hooks/usePrettyText";
import { assertUnreachable } from "@phoenix/typeUtils";

type PrettyTextProps = {
  children: string;
  /**
   * Style overrides for the pre tag
   */
  preCSS?: SerializedStyles;
};

export function PrettyText({ children, preCSS }: PrettyTextProps) {
  const { text, textType } = usePrettyText(children);
  if (textType === "string") {
    return (
      <pre
        css={css`
          white-space: pre-wrap;
          text-wrap: wrap;
          overflow-wrap: anywhere;
          font-size: var(--ac-global-font-size-s);
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
  assertUnreachable(textType);
}
