import { css } from "@emotion/react";
import type { Ref } from "react";
import type { ColorSwatchProps as AriaColorSwatchProps } from "react-aria-components";
import { ColorSwatch as AriaColorSwatch } from "react-aria-components";

import type { SizingProps } from "@phoenix/components/core/types";

type ColorSwatchShape = "square" | "circle";

export interface ColorSwatchProps extends AriaColorSwatchProps, SizingProps {
  shape?: ColorSwatchShape;
}

export function ColorSwatch({
  ref,
  color,
  size = "M",
  shape = "square",
}: ColorSwatchProps & { ref?: Ref<HTMLDivElement> }) {
  // We have to special case CSS variables and color functions since they are
  // technically not part of the aria color swatch, which can only parse literal
  // colors. But it's better to have a unified color swatch so going with this
  // approach
  const isCSSValue =
    typeof color === "string" &&
    (color.startsWith("var") || color.startsWith("color-mix("));
  const additionalCSS = isCSSValue
    ? css`
        background-color: ${color} !important;
      `
    : undefined;
  return (
    <AriaColorSwatch
      color={isCSSValue ? undefined : color}
      data-shape={shape}
      data-size={size}
      ref={ref}
      css={css(
        css`
          --color-swatch-size: 6px;
          width: var(--color-swatch-size);
          height: var(--color-swatch-size);
          display: inline-block;
          flex-shrink: 0;
          &[data-shape="square"] {
            border-radius: 2px;
          }
          &[data-shape="circle"] {
            border-radius: 50%;
          }
          &[data-size="S"] {
            --color-swatch-size: 6px;
          }
          &[data-size="M"] {
            --color-swatch-size: 8px;
          }
          &[data-size="L"] {
            --color-swatch-size: 20px;
          }
        `,
        additionalCSS
      )}
    />
  );
}

ColorSwatch.displayName = "ColorSwatch";
