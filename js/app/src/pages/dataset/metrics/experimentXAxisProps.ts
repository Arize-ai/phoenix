import type { XAxisProps, YAxisProps } from "recharts";

import {
  compactCategoryXAxisProps,
  compactYAxisProps,
} from "@phoenix/components/chart";

import { makeExperimentAxisTick } from "./ExperimentBaselineReference";

/**
 * X axis props shared by every experiment metric chart: one category tick per
 * experiment labeled with its iteration (sequence) number, which stays
 * compact no matter how long the experiment name is. The tooltip carries the
 * full name. Experiments with a color (a compare page selection) lead their
 * tick with a dot in that color.
 */
export function getExperimentXAxisProps({
  baselineSequenceNumber,
  experiments = [],
}: {
  baselineSequenceNumber?: number;
  experiments?: ReadonlyArray<{
    sequenceNumber: number;
    experimentColor?: string | null;
  }>;
}): XAxisProps {
  const experimentColors = new Map(
    experiments.flatMap(({ sequenceNumber, experimentColor }) =>
      experimentColor == null
        ? []
        : [[sequenceNumber, experimentColor] as const]
    )
  );
  return {
    ...compactCategoryXAxisProps,
    dataKey: "sequenceNumber",
    scale: "band",
    tick: makeExperimentAxisTick({ baselineSequenceNumber, experimentColors }),
  };
}

/**
 * A fixed y-axis gutter keeps experiment ticks aligned across stacked charts,
 * regardless of how wide each chart's formatted y-axis values are.
 */
export const experimentMetricsYAxisProps: YAxisProps = {
  ...compactYAxisProps,
  width: 60,
};
