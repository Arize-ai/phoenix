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

import { ExperimentRepetitionTokenCountDetails } from "./ExperimentRepetitionTokenCountDetails";

type ExperimentRepetitionTokenCountProps = {
  /**
   * The total number of tokens in the experiment repetition
   */
  tokenCountTotal: number;
  /**
   * The id of the experiment repetition node
   */
  experimentRepetitionId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the number of tokens in an experiment repetition with detailed breakdown
 */
export function ExperimentRepetitionTokenCount(
  props: ExperimentRepetitionTokenCountProps
) {
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
          <ExperimentRepetitionTokenCountDetails
            experimentRepetitionId={props.experimentRepetitionId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
