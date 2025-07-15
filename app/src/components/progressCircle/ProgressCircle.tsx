import React, { forwardRef, Ref } from "react";
import { ProgressBar } from "react-aria-components";

import { progressCircleCSS } from "./styles";
import { ProgressCircleProps } from "./types";

function ProgressCircle(props: ProgressCircleProps, ref: Ref<HTMLDivElement>) {
  const { isIndeterminate = false, value, size = "M" } = props;

  return (
    <ProgressBar
      {...props}
      data-size={size}
      data-indeterminate={isIndeterminate || undefined}
      css={progressCircleCSS}
      ref={ref}
      style={
        !isIndeterminate && value != null
          ? ({ "--progress-circle-value": value } as React.CSSProperties)
          : undefined
      }
    >
      <svg className="progress-circle__svg">
        {/* Background track */}
        <circle className="progress-circle__background" />
        {/* Progress arc */}
        <circle className="progress-circle__arc" />
      </svg>
    </ProgressBar>
  );
}

const _ProgressCircle = forwardRef(ProgressCircle);
export { _ProgressCircle as ProgressCircle };
