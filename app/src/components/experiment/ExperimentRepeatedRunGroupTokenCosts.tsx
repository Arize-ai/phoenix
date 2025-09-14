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
        <TokenCosts size={props.size} aria-role="button">
          {props.costTotal}
        </TokenCosts>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <ExperimentRepeatedRunGroupTokenCostDetails
            experimentRepeatedRunGroupId={props.experimentRepeatedRunGroupId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
