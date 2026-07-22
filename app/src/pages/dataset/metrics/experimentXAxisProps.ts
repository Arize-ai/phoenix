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
 * full name.
 */
export function getExperimentXAxisProps(
  baselineSequenceNumber?: number
): XAxisProps {
  return {
    ...compactCategoryXAxisProps,
    dataKey: "sequenceNumber",
    scale: "band",
    tick: makeExperimentAxisTick(baselineSequenceNumber),
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
