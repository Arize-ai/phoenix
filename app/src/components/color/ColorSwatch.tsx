import { forwardRef } from "react";
import {
  ColorSwatch as AriaColorSwatch,
  ColorSwatchProps as AriaColorSwatchProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { SizingProps } from "@phoenix/components/types";

type ColorSwatchShape = "square" | "circle";

export interface ColorSwatchProps extends AriaColorSwatchProps, SizingProps {
  shape?: ColorSwatchShape;
}

export const ColorSwatch = forwardRef<HTMLDivElement, ColorSwatchProps>(
  ({ color, size = "M", shape = "square" }, ref) => {
    // We have to special case CSS variables since this is technically not part of
    // the aria color swatch. But it's better to have a unified color swatch so going
    // with this approach
    const isCSSVariable = typeof color === "string" && color.startsWith("var");
    const additionalCSS = isCSSVariable
      ? css`
          background-color: ${color} !important;
        `
      : undefined;
    return (
      <AriaColorSwatch
        color={isCSSVariable ? undefined : color}
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
);

ColorSwatch.displayName = "ColorSwatch";
