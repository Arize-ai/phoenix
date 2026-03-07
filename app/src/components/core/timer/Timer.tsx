import { css } from "@emotion/react";
import { useEffect, useMemo, useState } from "react";

import type { TextColorValue, TextSize } from "@phoenix/components/core/types";

import { textSizeCSS } from "../content/styles";
import { getTextColor } from "../content/textUtils";

export type TimerProps = {
  /**
   * The start time to count elapsed time from.
   * If not provided, the timer starts from 00:00 when mounted.
   */
  startTime?: Date;
  /**
   * The color of the timer text.
   * @default 'text-900'
   */
  color?: TextColorValue;
  /**
   * Sets text size.
   * @default 'S'
   */
  size?: TextSize;
};

const timerCSS = css`
  font-family: "Geist Mono", monospace;
  font-variant-numeric: tabular-nums;
  ${textSizeCSS};
`;

function padTwo(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
  }
  return `${padTwo(minutes)}:${padTwo(seconds)}`;
}

function getElapsedSeconds(startTime: Date): number {
  return Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
}

export function Timer(props: TimerProps) {
  const { startTime, color = "text-900", size = "S" } = props;
  const effectiveStartTime = useMemo(
    () => startTime ?? new Date(),
    [startTime]
  );
  const [elapsed, setElapsed] = useState(() =>
    getElapsedSeconds(effectiveStartTime)
  );

  useEffect(() => {
    setElapsed(getElapsedSeconds(effectiveStartTime));
    const interval = setInterval(() => {
      setElapsed(getElapsedSeconds(effectiveStartTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [effectiveStartTime]);

  return (
    <time
      css={timerCSS}
      data-size={size}
      style={{ color: getTextColor(color) }}
      dateTime={`PT${elapsed}S`}
    >
      {formatElapsed(elapsed)}
    </time>
  );
}
