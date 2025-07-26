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

import { ExperimentAverageRunTokenCountDetails } from "./ExperimentAverageRunTokenCountDetails";

type ExperimentAverageRunTokenCountProps = {
  /**
   * The average number of tokens in an experiment run for the experiment
   */
  averageRunTokenCountTotal: number | null;
  /**
   * The id of the experiment
   */
  experimentId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the average number of tokens in an experiment run with detailed breakdown
 */
export function ExperimentAverageRunTokenCount(
  props: ExperimentAverageRunTokenCountProps
) {
  if (props.averageRunTokenCountTotal == null) {
    return <TokenCount size={props.size}>{null}</TokenCount>;
  }

  return (
    <TooltipTrigger>
      <Pressable>
        <TokenCount size={props.size} role="button">
          {props.averageRunTokenCountTotal}
        </TokenCount>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <ExperimentAverageRunTokenCountDetails
            experimentId={props.experimentId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
