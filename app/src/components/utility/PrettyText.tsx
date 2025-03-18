import React from "react";
import { css } from "@emotion/react";

import { JSONBlock } from "@phoenix/components/code";
import { usePrettyText } from "@phoenix/hooks/usePrettyText";
import { assertUnreachable } from "@phoenix/typeUtils";

export function PrettyText({ children }: { children: string }) {
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
