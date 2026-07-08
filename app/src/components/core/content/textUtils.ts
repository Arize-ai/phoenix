import type {
  ColorValue,
  TextColorValue,
} from "@phoenix/components/core/types";

import { colorValue } from "../utils";

export function getTextColor(color: TextColorValue): string {
  if (color === "inherit") {
    return "inherit";
  }
  if (color.startsWith("text-")) {
    const [, num] = color.split("-");
    return `var(--global-text-color-${num})`;
  }
  return colorValue(color as ColorValue);
}
