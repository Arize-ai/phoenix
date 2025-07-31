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

import { ExperimentTokenCostsDetails } from "./ExperimentTokenCostsDetails";

type ExperimentTokenCostsProps = {
  /**
   * The total cost of the experiment
   */
  totalCost: number;
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
 * Displays the cost of an experiment with detailed breakdown
 */
export function ExperimentTokenCosts(props: ExperimentTokenCostsProps) {
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
          <ExperimentTokenCostsDetails experimentId={props.experimentId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
