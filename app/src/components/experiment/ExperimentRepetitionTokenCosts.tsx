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

import { ExperimentRepetitionTokenCostsDetails } from "./ExperimentRepetitionTokenCostsDetails";

type ExperimentRepetitionTokenCostsProps = {
  /**
   * The total cost of the experiment repetition
   */
  costTotal: number;
  /**
   * The id of the experiment repetition node
   */
  experimentRepetitionId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the cost of an experiment repetition with detailed breakdown
 */
export function ExperimentRepetitionTokenCosts(
  props: ExperimentRepetitionTokenCostsProps
) {
  return (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts size={props.size} aria-role="button">
          {props.costTotal}
        </TokenCosts>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <ExperimentRepetitionTokenCostsDetails
            experimentRepetitionId={props.experimentRepetitionId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
