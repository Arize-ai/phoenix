import type { Ref } from "react";
import { forwardRef } from "react";
import { ProgressBar as ReactAriaProgressBar } from "react-aria-components";

import { progressBarCSS } from "./styles";
import type { ProgressBarProps } from "./types";

function ProgressBar(
  { width, height, animateFill = false, ...props }: ProgressBarProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <ReactAriaProgressBar
      {...props}
      ref={ref}
      css={progressBarCSS}
      style={{ width, height }}
    >
      {({ percentage }) => (
        <div className="progress-bar__track">
          <div
            className="progress-bar__fill"
            style={{
              width: percentage + "%",
              transition: animateFill
                ? "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
                : undefined,
            }}
          />
        </div>
      )}
    </ReactAriaProgressBar>
  );
}

const _ProgressBar = forwardRef(ProgressBar);
export { _ProgressBar as ProgressBar };
