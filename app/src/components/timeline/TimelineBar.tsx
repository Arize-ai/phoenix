import { HTMLProps, useMemo } from "react";
import { css } from "@emotion/react";

const trackCSS = css`
  height: var(--ac-global-dimension-size-75);
  border-radius: 3px;
  background-color: var(--ac-global-color-grey-300);
  width: 100%;
  position: relative;
  overflow: hidden;
`;

const barCSS = css`
  position: absolute;
  top: 0;
  bottom: 0;
`;

export interface TimelineBarProps extends HTMLProps<HTMLDivElement> {
  /**
   * the color of the inner bar
   */
  color: string;
  /**
   * The time range of the overall timeline
   */
  overallTimeRange: TimeRange;
  /**
   * the time range of the specific span of time range
   */
  spanTimeRange: TimeRange;
}
/**
 * A bar, not dissimilar to a progress bar that shows a time slice as part of a whole
 */
export function TimelineBar({
  color,
  overallTimeRange,
  spanTimeRange,
  ...props
}: TimelineBarProps) {
  const [startPercentage, endPercentage] = useMemo(() => {
    const overallDuration =
      overallTimeRange.end.valueOf() - overallTimeRange.start.valueOf();
    const startPercentage =
      ((spanTimeRange.start.valueOf() - overallTimeRange.start.valueOf()) /
        overallDuration) *
      100;
    const endPercentage =
      ((spanTimeRange.end.valueOf() - overallTimeRange.start.valueOf()) /
        overallDuration) *
      100;
    return [startPercentage, endPercentage];
  }, [overallTimeRange, spanTimeRange]);
  return (
    <div
      className="timeline-bar timeline-bar__track"
      css={trackCSS}
      title={`${overallTimeRange.start.toLocaleString()} - ${overallTimeRange.end.toLocaleString()}`}
      {...props}
    >
      <div
        className="timeline-bar__bar"
        css={barCSS}
        title={`${spanTimeRange.start.toLocaleString()} - ${spanTimeRange.end.toLocaleString()}`}
        data-start-percentage={startPercentage}
        data-end-percentage={endPercentage}
        style={{
          backgroundColor: color,
          left: `${startPercentage}%`,
          right: `${100 - endPercentage}%`,
        }}
      />
    </div>
  );
}
