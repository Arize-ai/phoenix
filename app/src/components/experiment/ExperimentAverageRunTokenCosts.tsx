import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";

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
        <TokenCosts size={props.size} role="button">
          {props.averageRunCostTotal}
        </TokenCosts>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <ExperimentAverageRunTokenCostsDetails
            experimentId={props.experimentId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
