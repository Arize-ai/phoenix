import React from "react";

import type { TextProps } from "@phoenix/components";
import { Text } from "@phoenix/components";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationScoreText } from "./AnnotationScoreText";

export const MeanScore = ({
  value,
  fallback = "--",
  positiveOptimization,
  ...props
}: {
  value?: number | null;
  fallback?: React.ReactNode;
  positiveOptimization?: boolean | null;
} & Omit<TextProps, "children">) => {
  if (value == null || typeof value !== "number" || isNaN(value)) {
    return (
      <Text {...props} fontFamily="mono">
        {fallback}
      </Text>
    );
  }
  return (
    <Text {...props}>
      <span aria-label="mean score">μ&nbsp;</span>
      <AnnotationScoreText
        elementType="span"
        fontFamily="mono"
        positiveOptimization={positiveOptimization}
      >
        {formatFloat(value)}
      </AnnotationScoreText>
    </Text>
  );
};
