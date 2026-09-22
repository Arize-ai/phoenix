import { Suspense } from "react";
import { Pressable } from "react-aria";

import type { TextProps } from "@phoenix/components";
import { RichTooltip, TooltipArrow, TooltipTrigger } from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";

import { TokenDetailsBreakdownSkeleton } from "../trace/TokenDetailsBreakdown";
import { ExperimentAverageRunTokenCostsDetails } from "./ExperimentAverageRunTokenCostsDetails";

type ExperimentAverageRunTokenCostsProps = {
  /**
   * The average cost of a run in the experiment
   */
  averageRunCostTotal: number;
  /**
   * The id of the experiment
   */
  experimentId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the average cost of a run in an experiment with detailed breakdown
 */
export function ExperimentAverageRunTokenCosts(
  props: ExperimentAverageRunTokenCostsProps
) {
  return (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts size={props.size} role="button" tabIndex={0}>
          {props.averageRunCostTotal}
        </TokenCosts>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense
          fallback={
            <TokenDetailsBreakdownSkeleton
              costs={{ total: props.averageRunCostTotal }}
              totalLabel="Average"
            />
          }
        >
          <ExperimentAverageRunTokenCostsDetails
            experimentId={props.experimentId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
