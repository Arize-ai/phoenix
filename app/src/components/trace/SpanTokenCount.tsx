import { Suspense } from "react";
import { Pressable, PressProps } from "react-aria";

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
  /**
   * Click handler for the token count
   */
  onPress?: PressProps["onPress"];
} & Omit<PressProps, "children">;

/**
 * Displays the number of tokens in the prompt and completion
 */
export function SpanTokenCount(props: SpanTokenCountProps) {
  const { tokenCountTotal, nodeId, size, onPress, ...pressableProps } = props;

  return (
    <TooltipTrigger>
      <Pressable onPress={onPress} {...pressableProps}>
        <TokenCount size={size} role="button">
          {tokenCountTotal}
        </TokenCount>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <SpanTokenCountDetails spanNodeId={nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
