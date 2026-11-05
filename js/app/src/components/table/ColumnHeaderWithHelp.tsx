import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components/core/content";
import { ContextualHelp } from "@phoenix/components/core/tooltip/ContextualHelp";
import { StopPropagation } from "@phoenix/components/StopPropagation";

const columnHeaderWithHelpCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-25);
  /* A metric label is short; wrapping it would double the header's height */
  white-space: nowrap;
`;

const helpTooltipCSS = css`
  max-width: 280px;
`;

/**
 * A column header label with an info tip explaining what the column holds.
 * Use it for metric columns whose name alone is not self-explanatory.
 *
 * Pressing the info tip does not sort the column.
 *
 * @example
 * ```tsx
 * header: () => (
 *   <ColumnHeaderWithHelp help="95% of evaluations finished within this long of being queued.">
 *     lag p95
 *   </ColumnHeaderWithHelp>
 * )
 * ```
 */
export function ColumnHeaderWithHelp({
  children,
  help,
}: {
  /** The column's label. */
  children: ReactNode;
  /** What the column's values mean. A string is rendered as small text. */
  help: ReactNode;
}) {
  return (
    <span css={columnHeaderWithHelpCSS}>
      <span>{children}</span>
      <StopPropagation>
        <ContextualHelp variant="info" placement="top" css={helpTooltipCSS}>
          {typeof help === "string" ? <Text size="S">{help}</Text> : help}
        </ContextualHelp>
      </StopPropagation>
    </span>
  );
}
