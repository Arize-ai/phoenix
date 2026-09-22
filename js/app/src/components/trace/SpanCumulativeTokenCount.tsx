import { Suspense } from "react";
import { Pressable } from "react-aria";

import type { TextProps } from "@phoenix/components";
import { RichTooltip, TooltipArrow, TooltipTrigger } from "@phoenix/components";

import { SpanCumulativeTokenCountDetails } from "./SpanCumulativeTokenCountDetails";
import { TokenCount } from "./TokenCount";
import { TokenDetailsBreakdownSkeleton } from "./TokenDetailsBreakdown";

type SpanCumulativeTokenCountProps = {
  /**
   * The total cumulative number of tokens for the span and all its descendants
   */
  tokenCountTotal: number;
  /**
   * The id of the span node
   */
  nodeId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the cumulative number of tokens for a span and all its descendants
 */
export function SpanCumulativeTokenCount(props: SpanCumulativeTokenCountProps) {
  return (
    <TooltipTrigger>
      <Pressable>
        <TokenCount size={props.size} role="button" tabIndex={0}>
          {props.tokenCountTotal}
        </TokenCount>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense
          fallback={
            <TokenDetailsBreakdownSkeleton
              tokens={{ total: props.tokenCountTotal }}
            />
          }
        >
          <SpanCumulativeTokenCountDetails spanNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
