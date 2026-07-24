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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- text-* and "inherit" handled above; remainder is ColorValue but startsWith can't narrow the literal union
  return colorValue(color as ColorValue);
}
