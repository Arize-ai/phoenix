import React from "react";

import { Flex, Label, Text } from "@arizeai/components";

import { formatFloat } from "@phoenix/utils/numberFormatUtils";

interface Evaluation {
  name: string;
  label?: string | null;
  score?: number | null;
}
export function EvaluationLabel({ evaluation }: { evaluation: Evaluation }) {
  const labelValue =
    evaluation.label ||
    (typeof evaluation.score == "number" && formatFloat(evaluation.score)) ||
    "n/a";
  return (
    <Label color="cyan-1000" shape="badge">
      <Flex direction="row" gap="size-50">
        <Text weight="heavy" textSize="small" color="inherit">
          {evaluation.name}
        </Text>
        <Text textSize="small">{labelValue}</Text>
      </Flex>
    </Label>
  );
}
