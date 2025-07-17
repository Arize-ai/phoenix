import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { SessionTokenCostsDetails } from "./SessionTokenCostsDetails";
import { TokenCosts } from "./TokenCosts";

type SessionTokenCostsProps = {
  /**
   * The total cost of the session
   */
  totalCost: number;
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
 * Displays the cost of a session with detailed breakdown
 */
export function SessionTokenCosts(props: SessionTokenCostsProps) {
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
          <SessionTokenCostsDetails sessionNodeId={props.nodeId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
