import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { SpanCumulativeTokenCountDetails } from "./SpanCumulativeTokenCountDetails";
import { TokenCount } from "./TokenCount";

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
        <TokenCount size={props.size} role="button">
          {props.tokenCountTotal}
        </TokenCount>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <SpanCumulativeTokenCountDetails spanNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
