import type { XAxisProps } from "recharts";

import { compactCategoryXAxisProps } from "@phoenix/components/chart";

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
    tick: makeExperimentAxisTick(baselineSequenceNumber),
  };
}
