import { HTMLAttributes, ReactNode } from "react";
import { css } from "@emotion/react";

import { ColorValue, StylableProps } from "@phoenix/components/types";
import { colorValue } from "@phoenix/components/utils";

interface IconProps extends StylableProps, HTMLAttributes<HTMLElement> {
  svg: ReactNode;
  /**
   * Passed through by wrapping components.
   * @private
   * @default false
   */
  isDisabled?: boolean;
  /**
   * The color of the icon
   * @default 'inherit'
   */
  color?: ColorValue | "inherit";
}

/**
 * Wraps the svg in a reasonable size and applies a color
 */
export const Icon = ({
  svg,
  isDisabled: _isDisabled,
  color = "inherit",
  css: propsCSS,
  ...restProps
}: IconProps) => {
  const resolvedColor = color === "inherit" ? "inherit" : colorValue(color);
  return (
    <i
      className={"ac-icon-wrap"}
      css={css(
        css`
          width: 1em;
          height: 1em;
          font-size: 1.2rem;
          color: ${resolvedColor};
          display: flex;
          svg {
            fill: currentColor;
            width: 1em;
            height: 1em;
            display: inline-block;
            flex-shrink: 0;
            user-select: none;
          }
        `,
        propsCSS
      )}
      {...restProps}
    >
      {svg}
    </i>
  );
};
