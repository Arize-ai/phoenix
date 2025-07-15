import { ProgressBarProps } from "react-aria-components";

export type Size = "S" | "M";

export interface ProgressCircleProps extends ProgressBarProps {
  size?: Size;
}
