import React from "react";

import { Flex, Label, Text } from "@arizeai/components";

import { formatFloat } from "@phoenix/utils/numberFormatUtils";

interface RetrievalEvaluation {
  name: string;
  metric: "ndcg" | "precision" | "hit";
  k?: number | null;
  score?: number | null;
}

type RetrievalEvaluationLabelProps = RetrievalEvaluation;

export function RetrievalEvaluationLabel(props: RetrievalEvaluationLabelProps) {
  const { name, metric, k, score } = props;
  const label = typeof k === "number" ? `${metric}@${k}` : metric;
  const labelValue = (typeof score == "number" && formatFloat(score)) || "n/a";
  return (
    <Label color="seafoam-1000" shape="badge">
      <Flex direction="row" gap="size-50">
        <Text weight="heavy" textSize="small" color="inherit">
          {name}
        </Text>
        <Text textSize="small" color="inherit">
          {label}
        </Text>
        <Text textSize="small">{labelValue}</Text>
      </Flex>
    </Label>
  );
}
