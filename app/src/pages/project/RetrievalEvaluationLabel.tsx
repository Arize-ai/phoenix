import React, { useMemo } from "react";
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

interface RetrievalEvaluation {
  name?: string;
  metric: "ndcg" | "precision" | "hit" | "hit rate";
  k?: number | null;
  score?: number | null;
}

type RetrievalEvaluationLabelProps = RetrievalEvaluation;

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

export function RetrievalEvaluationLabel(props: RetrievalEvaluationLabelProps) {
  const { name, metric, k, score } = props;
  const label = typeof k === "number" ? `${metric}@${k}` : metric;
  const labelValue = useMemo(() => {
    if (metric === "hit") {
      return score ? "true" : "false";
    }
    return (typeof score == "number" && formatFloat(score)) || "n/a";
  }, [score, metric]);
  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>
        <Label color="seafoam-1000" shape="badge">
          <Flex direction="row" gap="size-50">
            {name ? (
              <div css={textCSS}>
                <Text weight="heavy" textSize="small" color="inherit">
                  {name}
                </Text>
              </div>
            ) : null}
            <div css={textCSS}>
              <Text textSize="small" color="inherit">
                {label}
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
            {name} {label}
          </Text>
          <Text textSize="small" color="inherit">
            {labelValue}
          </Text>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}
