import { ColorValue } from "@phoenix/components/types";

type ColorType = "default" | "background" | "border" | "icon" | "status";
export function colorValue(value: ColorValue, type: ColorType = "default") {
  // TODO actually support semantic colors
  return `var(--ac-global-color-${value}, var(--ac-semantic-${value}-color-${type}))`;
}
