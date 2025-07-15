export type Size = "S" | "M";

export interface ProgressCircleProps {
  isIndeterminate?: boolean;
  value?: number;
  size?: Size;
  "aria-label"?: string;
}
