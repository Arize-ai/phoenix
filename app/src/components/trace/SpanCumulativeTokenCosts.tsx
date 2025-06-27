import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { SpanCumulativeTokenCostsDetails } from "./SpanCumulativeTokenCostsDetails";
import { TokenCosts } from "./TokenCosts";

type SpanCumulativeTokenCostsProps = {
  /**
   * The total cost of the span
   */
  totalCost: number;
  /**
   * The id of the span node
   */
  spanNodeId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the cumulative cost of a span with detailed breakdown
 */
export function SpanCumulativeTokenCosts(props: SpanCumulativeTokenCostsProps) {
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
          <SpanCumulativeTokenCostsDetails spanNodeId={props.spanNodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
