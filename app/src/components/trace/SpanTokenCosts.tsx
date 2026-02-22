import { Suspense } from "react";
import { Pressable } from "react-aria";

import type { TextProps } from "@phoenix/components";
import {
  Loading,
  RichTooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { SpanTokenCostsDetails } from "./SpanTokenCostsDetails";
import { TokenCosts } from "./TokenCosts";

type SpanTokenCostsProps = {
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
 * Displays the cost of a span with detailed breakdown
 */
export function SpanTokenCosts(props: SpanTokenCostsProps) {
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
          <SpanTokenCostsDetails spanNodeId={props.spanNodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
