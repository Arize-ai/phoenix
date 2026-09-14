import { css } from "@emotion/react";
import { useMemo } from "react";

import { useTheme } from "@phoenix/contexts";

import { tokenizeJson } from "./jsonTokens";
import { pierreTokenColors } from "./pierreCodeMirrorTheme";

/**
 * Read-only JSON in the code blocks' colors, as a plain `<pre>` rather than an
 * editor. Mounting an editor costs tens of milliseconds; a table of them
 * stutters while it scrolls. Use this for cells that only show a value, and
 * `JSONBlock` where the reader needs folding, selection, or a full document.
 */
export function JSONPreview({ value }: { value: string }) {
  const { theme } = useTheme();
  const colors = pierreTokenColors[theme];
  const tokens = useMemo(() => tokenizeJson(value), [value]);

  return (
    <pre css={preCSS}>
      {tokens.map((token, index) =>
        token.kind === "text" ? (
          token.text
        ) : (
          <span key={index} style={{ color: colors[token.kind] }}>
            {token.text}
          </span>
        )
      )}
    </pre>
  );
}

const preCSS = css`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
`;
