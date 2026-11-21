import { Suspense } from "react";
import { Focusable } from "react-aria";

import type { TextProps } from "@phoenix/components";
import { RichTooltip, TooltipArrow, TooltipTrigger } from "@phoenix/components";

import { SpanTokenCountDetails } from "./SpanTokenCountDetails";
import { TokenCount } from "./TokenCount";
import { TokenDetailsBreakdownSkeleton } from "./TokenDetailsBreakdown";

type SpanTokenCountProps = {
  /**
   * The total number of tokens in the prompt and completion
   */
  tokenCountTotal: number;
  /**
   * The id of the node (span, trace, session, etc.)
   */

  nodeId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
  /**
   * The color of the icon and text
   */
  color?: TextProps["color"];
};

/**
 * Displays the number of tokens in the prompt and completion
 */
export function SpanTokenCount(props: SpanTokenCountProps) {
  return (
    <TooltipTrigger>
      <Focusable>
        <TokenCount
          size={props.size}
          color={props.color}
          role="button"
          tabIndex={0}
        >
          {props.tokenCountTotal}
        </TokenCount>
      </Focusable>
      <RichTooltip placement="end">
        <TooltipArrow />
        <Suspense
          fallback={
            <TokenDetailsBreakdownSkeleton
              tokens={{ total: props.tokenCountTotal }}
            />
          }
        >
          <SpanTokenCountDetails spanNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
