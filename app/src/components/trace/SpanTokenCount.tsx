import { Suspense, useCallback } from "react";
import { Pressable, PressEvent } from "react-aria";

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
  const handlePress = useCallback((e: PressEvent) => {
    e.continuePropagation(); // allow click to propagate to parent
  }, []);

  return (
    <TooltipTrigger>
      <Pressable onPress={handlePress}>
        <TokenCount size={props.size} role="button">
          {props.tokenCountTotal}
        </TokenCount>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <SpanTokenCountDetails spanNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
