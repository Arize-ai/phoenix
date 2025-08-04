import { Suspense } from "react";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { SpanTokenCountDetails } from "./SpanTokenCountDetails";
import { TokenCount } from "./TokenCount";

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
};

/**
 * Displays the number of tokens in the prompt and completion
 */
export function SpanTokenCount(props: SpanTokenCountProps) {
  return (
    <TooltipTrigger>
      <TokenCount size={props.size} role="button">
        {props.tokenCountTotal}
      </TokenCount>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <SpanTokenCountDetails spanNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
