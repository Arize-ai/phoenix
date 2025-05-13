import { useMemo } from "react";
import { css } from "@emotion/react";

import { HelpTooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Text } from "@phoenix/components";
import { baseAnnotationLabelCSS } from "@phoenix/components/annotation";
import { ColorSwatch } from "@phoenix/components/ColorSwatch";
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
    return (typeof score == "number" && formatFloat(score)) || "--";
  }, [score, metric]);
  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>
        <div css={baseAnnotationLabelCSS}>
          <Flex direction="row" gap="size-100" alignItems={"center"}>
            <ColorSwatch color={"var(--ac-global-color-seafoam-1000)"} />
            {name ? (
              <div css={textCSS}>
                <Text weight="heavy" size="XS" color="inherit">
                  {name}
                </Text>
              </div>
            ) : null}
            <div css={textCSS}>
              <Text size="XS" color="inherit">
                {label}
              </Text>
            </div>
            <div css={textCSS}>
              <Text size="XS">{labelValue}</Text>
            </div>
          </Flex>
        </div>
      </TriggerWrap>
      <HelpTooltip>
        <Flex direction="row" gap="size-100">
          <Text weight="heavy" color="inherit">
            {name} {label}
          </Text>
          <Text color="inherit">{labelValue}</Text>
        </Flex>
      </HelpTooltip>
    </TooltipTrigger>
  );
}
