import type { Ref } from "react";
import React from "react";
import { ProgressBar } from "react-aria-components";

import type { CSSPropertiesWithVars } from "@phoenix/components/core/types";

import { progressCircleCSS } from "./styles";
import type { ProgressCircleProps } from "./types";

/** Exposes the progress value to CSS as a custom property. */
function progressValueStyle(value: number): CSSPropertiesWithVars {
  return { "--progress-circle-value": value };
}

function ProgressCircle({
  ref,
  ...props
}: ProgressCircleProps & { ref?: Ref<HTMLDivElement> }) {
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
          ? progressValueStyle(value)
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

export { ProgressCircle };
