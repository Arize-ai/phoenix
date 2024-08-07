import React, { useMemo } from "react";

import { Flex, Icon, Icons, Text, TextProps } from "@arizeai/components";

import { formatFloat } from "@phoenix/utils/numberFormatUtils";

export function LatencyText({
  latencyMs,
  textSize = "medium",
  showIcon = true,
}: {
  latencyMs: number;
  textSize?: TextProps["textSize"];
  /**
   * Whether to show the clock icon.
   * @default true
   */
  showIcon?: boolean;
}) {
  const color = useMemo(() => {
    if (latencyMs < 3000) {
      return "green-1200";
    } else if (latencyMs < 8000) {
      return "yellow-1200";
    } else if (latencyMs < 12000) {
      return "orange-1200";
    } else {
      return "red-1200";
    }
  }, [latencyMs]);
  const latencyText = useMemo(() => {
    if (latencyMs < 10) {
      return formatFloat(latencyMs) + "ms";
    }
    return formatFloat(latencyMs / 1000) + "s";
  }, [latencyMs]);

  return (
    <Flex
      direction="row"
      alignItems="center"
      justifyContent="start"
      gap="size-50"
    >
      {showIcon ? (
        <Text color={color} textSize={textSize}>
          <Icon svg={<Icons.ClockOutline />} />
        </Text>
      ) : null}
      <Text color={color} textSize={textSize}>
        {latencyText}
      </Text>
    </Flex>
  );
}
