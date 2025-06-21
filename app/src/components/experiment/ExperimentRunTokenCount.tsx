import { Suspense } from "react";
import { Pressable } from "react-aria";

import {
  Loading,
  RichTooltip,
  TextProps,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { TokenCount } from "../trace/TokenCount";

import { ExperimentRunTokenCountDetails } from "./ExperimentRunTokenCountDetails";

type ExperimentRunTokenCountProps = {
  /**
   * The total number of tokens in the experiment run
   */
  tokenCountTotal: number;
  /**
   * The id of the experiment run node
   */
  experimentRunId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the number of tokens in an experiment run with detailed breakdown
 */
export function ExperimentRunTokenCount(props: ExperimentRunTokenCountProps) {
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
          <ExperimentRunTokenCountDetails
            experimentRunId={props.experimentRunId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
