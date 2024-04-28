import React from "react";
import { css } from "@emotion/react";

import {
  Flex,
  Label,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { formatFloat } from "@phoenix/utils/numberFormatUtils";

interface Evaluation {
  name: string;
  label?: string | null;
  score?: number | null;
}

const textCSS = css`
  display: flex;
  align-items: center;
  .ac-text {
    display: inline-block;
    max-width: 9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
export function EvaluationLabel({ evaluation }: { evaluation: Evaluation }) {
  const labelValue =
    evaluation.label ||
    (typeof evaluation.score == "number" && formatFloat(evaluation.score)) ||
    "n/a";
  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>
        <Label color="cyan-1000" shape="badge">
          <Flex direction="row" gap="size-50">
            <div css={textCSS}>
              <Text weight="heavy" textSize="small" color="inherit">
                {evaluation.name}
              </Text>
            </div>
            <div css={textCSS}>
              <Text textSize="small">{labelValue}</Text>
            </div>
          </Flex>
        </Label>
      </TriggerWrap>
      <Tooltip>
        <Flex direction="row" gap="size-100">
          <Text weight="heavy" textSize="small" color="inherit">
            {evaluation.name}
          </Text>
          <Text textSize="small" color="inherit">
            {labelValue}
          </Text>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}
