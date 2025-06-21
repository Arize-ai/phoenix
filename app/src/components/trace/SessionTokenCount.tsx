import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { SessionTokenCountDetails } from "./SessionTokenCountDetails";
import { TokenCount } from "./TokenCount";

type SessionTokenCountProps = {
  /**
   * The total number of tokens in the session
   */
  tokenCountTotal: number;
  /**
   * The id of the session node
   */
  nodeId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the number of tokens in a session with detailed breakdown
 */
export function SessionTokenCount(props: SessionTokenCountProps) {
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
          <SessionTokenCountDetails sessionNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
