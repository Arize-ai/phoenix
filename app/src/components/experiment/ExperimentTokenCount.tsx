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

import { ExperimentTokenCountDetails } from "./ExperimentTokenCountDetails";

type ExperimentTokenCountProps = {
  /**
   * The total number of tokens in the experiment
   */
  tokenCountTotal: number | null;
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
 * Displays the number of tokens in an experiment with detailed breakdown
 */
export function ExperimentTokenCount(props: ExperimentTokenCountProps) {
  if (props.tokenCountTotal == null) {
    return <TokenCount size={props.size}>{null}</TokenCount>;
  }

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
          <ExperimentTokenCountDetails experimentId={props.experimentId} />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
