import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import { useTimeFormatters } from "@phoenix/hooks";

import { LatencyText } from "./LatencyText";
import type { ISpanItem } from "./types";

const timingCSS = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--global-dimension-size-200);
  white-space: nowrap;
`;

export type SpanTimingDetailsProps = Pick<
  ISpanItem,
  "startTime" | "endTime" | "latencyMs"
>;

/**
 * A preview's timing line: start to end time of day, with the latency at the
 * end. An unfinished span runs to "now".
 */
export function SpanTimingDetails({
  startTime,
  endTime,
  latencyMs,
}: SpanTimingDetailsProps) {
  const { timeOfDayFormatter } = useTimeFormatters();
  return (
    <div className="span-timing-details" css={timingCSS}>
      <Text size="S" fontFamily="mono" color="text-700">
        {timeOfDayFormatter(new Date(startTime))}
        {" to "}
        {endTime ? timeOfDayFormatter(new Date(endTime)) : "now"}
      </Text>
      <LatencyText latencyMs={latencyMs} size="S" showIcon={false} />
    </div>
  );
}
