import type { SequentialColorInterpolator } from "../colors";
import {
  getSequentialGradientCSS,
  useSequentialBlueColorInterpolator,
} from "../colors";
import type { ConfusionMatrixScaleType } from "./confusionMatrixUtils";
import { confusionMatrixLegendCSS } from "./styles";

export type ConfusionMatrixLegendProps = {
  /**
   * The interpolator the matrix (or matrices) on the page are colored with.
   * Defaults to the theme-aware Phoenix blues.
   */
  colorInterpolator?: SequentialColorInterpolator;
  /**
   * The count scale of the matrices this legend describes; names the scale
   * in the default label.
   * @default 'linear'
   */
  scaleType?: ConfusionMatrixScaleType;
  /**
   * What the density encodes, e.g. "span count · log scale"
   * @default 'count · <scaleType> scale'
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
  scaleType = "linear",
  label,
}: ConfusionMatrixLegendProps) {
  const interpolator = useSequentialBlueColorInterpolator(colorInterpolator);
  return (
    <div className="confusion-matrix-legend" css={confusionMatrixLegendCSS}>
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
      <span className="confusion-matrix-legend__separator">·</span>
      <span>{label ?? `count · ${scaleType} scale`}</span>
    </div>
  );
}
