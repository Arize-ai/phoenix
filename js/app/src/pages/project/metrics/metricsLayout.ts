import { css } from "@emotion/react";

/**
 * The scroll container around a column of metric panels. Scrolls in both
 * directions: the rows hold their charts at a readable width rather than
 * shrinking to fit a narrow window.
 */
export const metricsScrollContainerCSS = css`
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
`;

/**
 * The column of metric panel rows. Sized to the widest row's charts at their
 * minimum width; every row stretches to it, so a scrolled page keeps its
 * charts aligned in a column.
 */
export const metricsPanelsColumnCSS = css`
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  min-width: min-content;
`;
