import { useMemo } from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, TextProps } from "@phoenix/components";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";
export function LatencyText({
  latencyMs,
  size = "M",
  showIcon = true,
}: {
  latencyMs: number;
  size?: TextProps["size"];
  /**
   * Whether to show the clock icon.
   * @default true
   */
  showIcon?: boolean;
}) {
  const color = useMemo(() => {
    if (latencyMs < 3000) {
      return "success";
    } else if (latencyMs < 8000) {
      return "warning";
    } else if (latencyMs < 12000) {
      return "danger";
    } else {
      return "severe";
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
      className="latency-text"
    >
      {showIcon ? (
        <Text color={color} size={size}>
          <Icon
            svg={<Icons.ClockOutline />}
            css={css`
              font-size: 1.1em;
            `}
          />
        </Text>
      ) : null}
      <Text color={color} size={size}>
        {latencyText}
      </Text>
    </Flex>
  );
}
