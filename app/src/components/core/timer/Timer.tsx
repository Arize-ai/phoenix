import { css } from "@emotion/react";
import { useEffect, useState } from "react";

import type {
  ColorValue,
  TextColorValue,
  TextSize,
} from "@phoenix/components/core/types";

import { colorValue } from "../utils";

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
  &[data-size="XS"] {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }
  &[data-size="S"] {
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-m);
    line-height: var(--global-line-height-m);
  }
  &[data-size="L"] {
    font-size: var(--global-font-size-l);
    line-height: var(--global-line-height-l);
  }
  &[data-size="XL"] {
    font-size: var(--global-font-size-xl);
    line-height: var(--global-line-height-xl);
  }
  &[data-size="XXL"] {
    font-size: var(--global-font-size-xxl);
    line-height: var(--global-line-height-xxl);
  }
`;

function getTextColor(color: TextColorValue): string {
  if (color === "inherit") {
    return "inherit";
  }
  if (color.startsWith("text-")) {
    const [, num] = color.split("-");
    return `var(--global-text-color-${num})`;
  }
  return colorValue(color as ColorValue);
}

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

function getElapsedSeconds(startTime: Date | undefined): number {
  if (!startTime) return 0;
  return Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
}

export function Timer(props: TimerProps) {
  const { startTime, color = "text-900", size = "S" } = props;
  const [elapsed, setElapsed] = useState(() => getElapsedSeconds(startTime));

  useEffect(() => {
    setElapsed(getElapsedSeconds(startTime));
    const interval = setInterval(() => {
      setElapsed(getElapsedSeconds(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

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
