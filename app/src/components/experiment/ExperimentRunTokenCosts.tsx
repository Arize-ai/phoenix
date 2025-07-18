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

import { ExperimentRunTokenCostsDetails } from "./ExperimentRunTokenCostsDetails";

type ExperimentRunTokenCostsProps = {
  /**
   * The total cost of the experiment run
   */
  totalCost: number;
  /**
   * The id of the experiment run node
   */
  experimentRunId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the cost of an experiment run with detailed breakdown
 */
export function ExperimentRunTokenCosts(props: ExperimentRunTokenCostsProps) {
  return (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts size={props.size} role="button">
          {props.totalCost}
        </TokenCosts>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <ExperimentRunTokenCostsDetails
            experimentRunId={props.experimentRunId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
