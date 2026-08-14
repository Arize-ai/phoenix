import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

const areaCSS = css`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

// Ideal 160px gap above the empty state (size-2000). As flex-shrink it gives
// way first when the area is too short to fit the content, down to a 60px floor
// (size-750) — so the empty state stays on screen rather than being pushed off
// the bottom of a short area.
const topSpacerCSS = css`
  flex: 0 1 var(--global-dimension-size-2000);
  min-height: var(--global-dimension-size-750);
`;

/**
 * Fills the available area and positions an {@link EmptyState} offset ~160px
 * from the top, centered horizontally. Use for full-page / full-region zero
 * states (e.g. the Dashboards "no project selected" or the Prompts empty
 * state). For table-tbody empties use `TableEmptyWrap` instead, which applies
 * the same offset within the table's visible scrollport.
 */
export function EmptyStateArea({ children }: PropsWithChildren) {
  return (
    <div css={areaCSS}>
      <div css={topSpacerCSS} aria-hidden="true" />
      {children}
    </div>
  );
}
