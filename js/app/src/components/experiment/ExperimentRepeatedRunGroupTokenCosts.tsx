import { Suspense } from "react";
import { Pressable } from "react-aria";

import type { TextProps } from "@phoenix/components";
import { RichTooltip, TooltipArrow, TooltipTrigger } from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";

import { TokenDetailsBreakdownSkeleton } from "../trace/TokenDetailsBreakdown";
import { ExperimentRepeatedRunGroupTokenCostDetails } from "./ExperimentRepeatedRunGroupTokenCostDetails";

type ExperimentRepeatedRunGroupTokenCostsProps = {
  /**
   * The total cost of the experiment repeated run group
   */
  costTotal: number | null;
  /**
   * The id of the experiment repeated run group node
   */
  experimentRepeatedRunGroupId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the cost of an experiment repeated run group with detailed breakdown
 */
export function ExperimentRepeatedRunGroupTokenCosts(
  props: ExperimentRepeatedRunGroupTokenCostsProps
) {
  return (
    <TooltipTrigger isDisabled={props.costTotal == null}>
      <Pressable>
        <TokenCosts size={props.size} role="button" tabIndex={0}>
          {props.costTotal}
        </TokenCosts>
      </Pressable>
      <RichTooltip placement="end">
        <TooltipArrow />
        <Suspense
          fallback={
            <TokenDetailsBreakdownSkeleton costs={{ total: props.costTotal }} />
          }
        >
          <ExperimentRepeatedRunGroupTokenCostDetails
            experimentRepeatedRunGroupId={props.experimentRepeatedRunGroupId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
