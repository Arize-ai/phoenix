import { forwardRef, Ref } from "react";
import { ProgressBar as ReactAriaProgressBar } from "react-aria-components";

import { progressBarCSS } from "./styles";
import { ProgressBarProps } from "./types";

function ProgressBar(
  { width, ...props }: ProgressBarProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <ReactAriaProgressBar
      {...props}
      ref={ref}
      css={progressBarCSS}
      style={{ width }}
    >
      {({ percentage }) => (
        <div className="progress-bar__track">
          <div
            className="progress-bar__fill"
            style={{ width: percentage + "%" }}
          />
        </div>
      )}
    </ReactAriaProgressBar>
  );
}

const _ProgressBar = forwardRef(ProgressBar);
export { _ProgressBar as ProgressBar };
