import { ProgressBarProps } from "react-aria-components";

import { ComponentSize } from "@phoenix/components/types";

export interface ProgressCircleProps extends ProgressBarProps {
  /**
   * The size of the progress circle
   * @default 'M'
   */
  size?: Omit<ComponentSize, "L">;
}
