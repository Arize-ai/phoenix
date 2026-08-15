import type { Ref } from "react";
import { ProgressBar as ReactAriaProgressBar } from "react-aria-components";

import { progressBarCSS } from "./styles";
import type { ProgressBarProps } from "./types";

function ProgressBar({
  ref,
  width,
  height,
  ...props
}: ProgressBarProps & { ref?: Ref<HTMLDivElement> }) {
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
            style={{ width: percentage + "%" }}
          />
        </div>
      )}
    </ReactAriaProgressBar>
  );
}

export { ProgressBar };
