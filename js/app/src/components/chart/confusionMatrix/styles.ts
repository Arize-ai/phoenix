import { css } from "@emotion/react";

/**
 * All sizing that varies with the `size` prop funnels through the
 * `--confusion-matrix-*` custom properties: each `data-size` block only
 * overrides properties, and exactly one rule consumes each of them.
 */
export const confusionMatrixCSS = css`
  --confusion-matrix-cell-min-height: var(--global-dimension-size-800);
  --confusion-matrix-count-font-size: var(--global-font-size-s);
  --confusion-matrix-count-line-height: normal;
  --confusion-matrix-header-font-size: var(--global-font-size-s);
  --confusion-matrix-total-min-height: var(--global-dimension-size-450);
  --confusion-matrix-grid-gap: var(--global-dimension-size-75);
  /* Approximate combined height of the axis-title and column-header rows,
   * used to center the y-axis label on the cells */
  --confusion-matrix-header-rows-block-size: var(--global-dimension-size-500);

  &[data-size="S"] {
    --confusion-matrix-cell-min-height: var(--global-dimension-size-450);
    --confusion-matrix-count-font-size: var(--global-font-size-xs);
    --confusion-matrix-header-font-size: var(--global-font-size-xs);
  }

  &[data-size="L"] {
    --confusion-matrix-cell-min-height: var(--global-dimension-size-1600);
    --confusion-matrix-count-font-size: var(--global-font-size-xl);
    --confusion-matrix-count-line-height: var(--global-line-height-xl);
  }

  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  width: 100%;

  .confusion-matrix__body {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: var(--global-dimension-size-50);
  }

  .confusion-matrix__y-axis-label {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
    /* Skip the axis-title and header rows so the label centers on the cells */
    padding-bottom: var(--confusion-matrix-header-rows-block-size);
  }

  .confusion-matrix__y-axis-label--with-totals {
    /* Also skip the totals row (min-height + grid gap) at the bottom */
    padding-top: calc(
      var(--confusion-matrix-total-min-height) +
        var(--confusion-matrix-grid-gap)
    );
  }

  .confusion-matrix__grid {
    flex: 1 1 0;
    min-width: 0;
    display: grid;
    gap: var(--confusion-matrix-grid-gap);
    align-items: stretch;
  }

  .confusion-matrix__x-axis-label {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }

  .confusion-matrix__column-header,
  .confusion-matrix__row-header {
    font-size: var(--confusion-matrix-header-font-size);
    color: var(--global-text-color-700);
    min-width: 0;
    overflow: hidden;

    /* Let the Truncate child shrink below its content width */
    > * {
      min-width: 0;
    }
  }

  .confusion-matrix__column-header {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .confusion-matrix__column-header--total,
  .confusion-matrix__row-header--total {
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
  }

  .confusion-matrix__row-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
    padding-inline-end: var(--global-dimension-size-100);
    max-width: var(--global-dimension-size-2000);
  }

  .confusion-matrix__cell,
  .confusion-matrix__total {
    position: relative;
    border-radius: var(--global-rounding-medium);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--global-dimension-size-25);
    padding: var(--global-dimension-size-100);
    min-width: 0;
    overflow: hidden;
  }

  .confusion-matrix__cell {
    min-height: var(--confusion-matrix-cell-min-height);
  }

  .confusion-matrix__cell--empty {
    background-color: var(--global-color-gray-100);
    color: var(--global-text-color-300);
  }

  .confusion-matrix__total {
    background-color: var(--global-color-gray-100);
    color: var(--global-text-color-900);
    /* Totals stay compact regardless of cell size */
    min-height: var(--confusion-matrix-total-min-height);
  }

  .confusion-matrix__total--grand {
    background-color: transparent;
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .confusion-matrix__count {
    font-family: var(--global-font-family-mono);
    font-weight: var(--global-font-weight-semibold);
    font-size: var(--confusion-matrix-count-font-size);
    line-height: var(--confusion-matrix-count-line-height);
  }

  .confusion-matrix__percentage {
    font-size: var(--global-font-size-xs);
    opacity: 0.75;
  }

  .confusion-matrix__total .confusion-matrix__percentage {
    color: var(--global-text-color-500);
    opacity: 1;
  }

  .confusion-matrix__quadrant {
    position: absolute;
    top: var(--global-dimension-size-100);
    right: var(--global-dimension-size-125);
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xxs);
    letter-spacing: 0.08em;
    opacity: 0.6;
  }
`;

export const confusionMatrixLegendCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-125);
  font-size: var(--global-font-size-xs);
  color: var(--global-text-color-500);

  .confusion-matrix-legend__gradient {
    width: var(--global-dimension-size-2500);
    height: var(--global-dimension-size-100);
    border-radius: var(--global-rounding-full);
  }

  .confusion-matrix-legend__separator {
    color: var(--global-text-color-300);
  }
`;
