import type { BarShapeProps } from "recharts";
import { Rectangle } from "recharts";

import type {
  ModelTokenDetailChartDatum,
  ModelTokenDetailSeries,
} from "./tokenDetails";
import { getModelTokenDetailBarRadius } from "./tokenDetails";

type ModelTokenDetailBarShapeProps = Omit<
  Partial<BarShapeProps>,
  "payload" | "radius"
> & {
  /** Every series in the chart, in stacking order. */
  allSeries: ReadonlyArray<ModelTokenDetailSeries>;
  /** Whether the legend currently hides a series. */
  isDataKeyHidden: (dataKey: string) => boolean;
  /** Row this segment belongs to, supplied by Recharts. */
  payload?: ModelTokenDetailChartDatum;
  /** Series this segment renders. */
  series: ModelTokenDetailSeries;
};

/**
 * A segment of a stacked model token-detail bar that rounds the ends of the
 * row it lands in.
 *
 * `Bar`'s own `radius` applies to every row alike, which cannot express "round
 * whichever segment happens to be outermost here"; only the shape knows which
 * row it is drawing.
 */
export function ModelTokenDetailBarShape({
  allSeries,
  isDataKeyHidden,
  payload,
  series,
  ...rectangleProps
}: ModelTokenDetailBarShapeProps) {
  return (
    <Rectangle
      {...rectangleProps}
      radius={
        payload &&
        getModelTokenDetailBarRadius({
          allSeries,
          datum: payload,
          isDataKeyHidden,
          series,
        })
      }
    />
  );
}
