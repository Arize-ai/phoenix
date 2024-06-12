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

interface Annotation {
  name: string;
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
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
export function AnnotationLabel({ annotation }: { annotation: Annotation }) {
  const labelValue =
    (typeof annotation.score == "number" && formatFloat(annotation.score)) ||
    annotation.label ||
    "n/a";
  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>
        <Label color="cyan-1000" shape="badge">
          <Flex direction="row" gap="size-50">
            <div css={textCSS}>
              <Text weight="heavy" textSize="small" color="inherit">
                {annotation.name}
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
            {annotation.name}
          </Text>
          <Text textSize="small" color="inherit">
            {labelValue}
          </Text>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}
