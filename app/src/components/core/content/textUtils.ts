import { css } from "@emotion/react";

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

export const textSizeCSS = css`
  &[data-size="XS"] {
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }
  &[data-size="S"] {
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-m);
    line-height: var(--global-line-height-m);
  }
  &[data-size="L"] {
    font-size: var(--global-font-size-l);
    line-height: var(--global-line-height-l);
  }
  &[data-size="XL"] {
    font-size: var(--global-font-size-xl);
    line-height: var(--global-line-height-xl);
  }
  &[data-size="XXL"] {
    font-size: var(--global-font-size-xxl);
    line-height: var(--global-line-height-xxl);
  }
`;
