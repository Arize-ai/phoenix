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

function ProgressCircle({
  isIndeterminate,
  value,
  size = "M",
  "aria-label": ariaLabel,
}: ProgressCircleProps) {
  return (
    <ProgressBar
      value={value}
      isIndeterminate={isIndeterminate}
      aria-label={ariaLabel}
      css={css(
        isIndeterminate ? progressCircleIndeterminateCSS(size) : undefined
      )}
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

export { ProgressCircle };
