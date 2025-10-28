import { useMemo } from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, TextProps } from "@phoenix/components";
import { TextColorValue } from "@phoenix/components/types/style";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";
export function LatencyText({
  latencyMs,
  size = "M",
  showIcon = true,
}: {
  latencyMs: number | null;
  size?: TextProps["size"];
  /**
   * Whether to show the clock icon.
   * @default true
   */
  showIcon?: boolean;
}) {
  const color: TextColorValue = useMemo(() => {
    if (latencyMs == null) {
      return "text-700";
    } else if (latencyMs < 3000) {
      return "success";
    } else if (latencyMs < 8000) {
      return "warning";
    } else {
      return "danger";
    }
  }, [latencyMs]);

  const latencyText = useMemo(() => latencyMsFormatter(latencyMs), [latencyMs]);

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
      <Text color={color} size={size} fontFamily="mono">
        {latencyText}
      </Text>
    </Flex>
  );
}
