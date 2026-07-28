import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";

import { getSpanKindColor } from "./spanKindColor";
import { SpanKindIcon, spanKindVisualCSS } from "./SpanKindIcon";

const spanKindBadgeCSS = css`
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: var(--global-dimension-size-250);
  gap: var(--global-dimension-size-50);
  padding: 0 var(--global-dimension-size-75) 0 var(--global-dimension-size-25);
  border: var(--global-border-size-thin) solid
    var(--span-kind-icon-border-color);
  border-radius: var(--global-rounding-small);
  background: var(--span-kind-icon-background-color);
  font-size: var(--global-dimension-font-size-75);
  line-height: var(--global-line-height-xs);
  white-space: nowrap;
  user-select: none;
`;

/** A span-kind glyph and label presented as one compact visual identifier. */
export function SpanKindBadge({ spanKind }: { spanKind: string }) {
  const { theme } = useTheme();

  return (
    <div
      css={css(spanKindVisualCSS, spanKindBadgeCSS)}
      style={{
        // @ts-expect-error custom CSS properties
        "--span-kind-icon-color": getSpanKindColor({ spanKind }),
      }}
      data-theme={theme}
    >
      <SpanKindIcon spanKind={spanKind} isFramed={false} />
      <span>{spanKind}</span>
    </div>
  );
}
