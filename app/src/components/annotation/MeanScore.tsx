import React from "react";

import { Text, TextProps } from "@phoenix/components";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

export const MeanScore = ({
  value,
  fallback = "--",
  ...props
}: {
  value?: number | null;
  fallback?: React.ReactNode;
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
      <span className="font-mono">{`${formatFloat(value)}`}</span>
    </Text>
  );
};
