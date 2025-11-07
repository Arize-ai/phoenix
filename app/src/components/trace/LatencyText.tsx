import { useMemo } from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, TextProps } from "@phoenix/components";
import { TextColorValue } from "@phoenix/components/types/style";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";
/**
 * The thresholds for the latency text color.
 * The numbers are in milliseconds.
 */
export type LatencyThresholds = {
  /**
   * The threshold for the fast latency.
   * Anything less than this is considered fast.
   */
  fast: number;
  /**
   * The threshold for the moderate latency.
   * Anything between this and the slow threshold is considered moderate. Anything greater than this is considered slow.
   */
  moderate: number;
};
export function LatencyText({
  latencyMs,
  size = "M",
  showIcon = true,
  latencyThresholds,
}: {
  latencyMs: number | null;
  size?: TextProps["size"];
  /**
   * The thresholds for the latency text color.
   * @default undefined
   */
  latencyThresholds?: LatencyThresholds;
  /**
   * Whether to show the clock icon.
   * @default true
   */
  showIcon?: boolean;
}) {
  const color: TextColorValue = useMemo(() => {
    if (latencyThresholds && latencyMs !== null) {
      if (latencyMs < latencyThresholds.fast) {
        return "success";
      } else if (latencyMs < latencyThresholds.moderate) {
        return "warning";
      } else {
        return "danger";
      }
    }
    return "text-700";
  }, [latencyMs, latencyThresholds]);

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
