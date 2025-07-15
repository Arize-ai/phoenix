import { forwardRef, Ref } from "react";
import { useProgressBar } from "react-aria";
import { ProgressBar } from "react-aria-components";
import { css } from "@emotion/react";

import {
  CENTER,
  CIRCUMFERENCE,
  progressCircleIndeterminateCSS,
  RADIUS,
  SIZES,
  STROKE_WIDTHS,
} from "./styles";
import type { ProgressCircleProps } from "./types";

function ProgressCircle(props: ProgressCircleProps, ref: Ref<HTMLDivElement>) {
  const { isIndeterminate, value, size = "M" } = props;
  const { progressBarProps } = useProgressBar(props);
  return (
    <ProgressBar
      {...progressBarProps}
      value={value}
      css={css(
        isIndeterminate ? progressCircleIndeterminateCSS(size) : undefined
      )}
      ref={ref}
    >
      {({ percentage }) => (
        <>
          <svg
            width={SIZES[size]}
            height={SIZES[size]}
            viewBox={`0 0 ${SIZES[size]} ${SIZES[size]}`}
            fill="none"
            className="progress-circle__svg"
          >
            {/* Background track */}
            <circle
              cx={CENTER(size)}
              cy={CENTER(size)}
              r={RADIUS(size)}
              stroke="var(--ac-global-color-grey-300)"
              strokeWidth={STROKE_WIDTHS[size]}
            />
            {/* Progress arc */}
            <circle
              cx={CENTER(size)}
              cy={CENTER(size)}
              r={RADIUS(size)}
              stroke="var(--ac-global-color-primary)"
              strokeWidth={STROKE_WIDTHS[size]}
              strokeDasharray={
                isIndeterminate
                  ? undefined
                  : `${CIRCUMFERENCE(size)} ${CIRCUMFERENCE(size)}`
              }
              strokeDashoffset={
                isIndeterminate
                  ? undefined
                  : CIRCUMFERENCE(size) -
                    ((percentage ?? 0) / 100) * CIRCUMFERENCE(size)
              }
              className="progress-circle__arc"
            />
          </svg>
        </>
      )}
    </ProgressBar>
  );
}

const _ProgressCircle = forwardRef(ProgressCircle);
export { _ProgressCircle as ProgressCircle };
