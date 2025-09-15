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

import { ExperimentRepeatedRunGroupTokenCountDetails } from "./ExperimentRepeatedRunGroupTokenCountDetails";

type ExperimentRepeatedRunGroupTokenCountProps = {
  /**
   * The total number of tokens in the experiment repeated run group
   */
  tokenCountTotal: number | null;
  /**
   * The id of the experiment repeated run group node
   */
  experimentRepeatedRunGroupId: string;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the number of tokens in an experiment repeated run group with detailed breakdown
 */
export function ExperimentRepeatedRunGroupTokenCount(
  props: ExperimentRepeatedRunGroupTokenCountProps
) {
  return (
    <TooltipTrigger isDisabled={props.tokenCountTotal == null}>
      <Pressable>
        <TokenCount size={props.size} role="button">
          {props.tokenCountTotal}
        </TokenCount>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <Suspense fallback={<Loading />}>
          <ExperimentRepeatedRunGroupTokenCountDetails
            experimentRepeatedRunGroupId={props.experimentRepeatedRunGroupId}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  );
}
