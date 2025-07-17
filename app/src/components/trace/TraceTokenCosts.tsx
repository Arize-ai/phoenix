import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { TokenCosts } from "./TokenCosts";
import { TraceTokenCostsDetails } from "./TraceTokenCostsDetails";

type TraceTokenCostsProps = {
  /**
   * The total cost of the trace
   */
  totalCost: number;
  /**
   * The id of the trace node
   */
  nodeId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the cost of a trace with detailed breakdown
 */
export function TraceTokenCosts(props: TraceTokenCostsProps) {
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
          <TraceTokenCostsDetails traceNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
