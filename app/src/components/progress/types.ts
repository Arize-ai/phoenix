import { ProgressBarProps as ReactAriaProgressBarProps } from "react-aria-components";

import { ComponentSize, StyleProps } from "@phoenix/components/types";

export interface ProgressCircleProps extends ReactAriaProgressBarProps {
  /**
   * The size of the progress circle
   * @default 'M'
   */
  size?: Exclude<ComponentSize, "L">;
}

export interface ProgressBarProps extends ReactAriaProgressBarProps {
  /**
   * The width of the progress bar (e.g. '200px', '100%')
   * @default '192px'
   */
  width?: StyleProps["width"];
}
