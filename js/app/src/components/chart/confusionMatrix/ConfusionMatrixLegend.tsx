import { css } from "@emotion/react";

import {
  getSequentialGradientCSS,
  useDefaultConfusionMatrixColorInterpolator,
} from "./confusionMatrixColors";
import type { SequentialColorInterpolator } from "./confusionMatrixUtils";

const legendCSS = css`
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

export type ConfusionMatrixLegendProps = {
  /**
   * The interpolator the matrix (or matrices) on the page are colored with.
   * Defaults to the theme-aware Phoenix blues.
   */
  colorInterpolator?: SequentialColorInterpolator;
  /**
   * What the density encodes, e.g. "span count · log scale"
   */
  label?: string;
};

/**
 * A fewer → more gradient key for one or more confusion matrices. Rendered
 * inside `ConfusionMatrix` by default; render it standalone (with
 * `showLegend` off on the matrices) when several matrices on a page share
 * one scale and should share one key.
 */
export function ConfusionMatrixLegend({
  colorInterpolator,
  label,
}: ConfusionMatrixLegendProps) {
  const defaultColorInterpolator = useDefaultConfusionMatrixColorInterpolator();
  const interpolator = colorInterpolator ?? defaultColorInterpolator;
  return (
    <div className="confusion-matrix-legend" css={legendCSS}>
      <span>fewer</span>
      <div
        className="confusion-matrix-legend__gradient"
        style={{
          background: getSequentialGradientCSS({
            colorInterpolator: interpolator,
          }),
        }}
      />
      <span>more</span>
      {label ? (
        <>
          <span className="confusion-matrix-legend__separator">·</span>
          <span>{label}</span>
        </>
      ) : null}
    </div>
  );
}
