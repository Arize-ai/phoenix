import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { TokenCount } from "./TokenCount";
import { TraceTokenCountDetails } from "./TraceTokenCountDetails";

type TraceTokenCountProps = {
  /**
   * The total number of tokens in the trace
   */
  tokenCountTotal: number;
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
 * Displays the number of tokens in a trace with detailed breakdown
 */
export function TraceTokenCount(props: TraceTokenCountProps) {
  return (
    <TooltipTrigger>
      <Pressable>
        <TokenCount size={props.size} role="button">
          {props.tokenCountTotal}
        </TokenCount>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <TraceTokenCountDetails traceNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
