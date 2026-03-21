import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode } from "react";

import type { ColorValue, StylableProps } from "@phoenix/components/core/types";
import { colorValue } from "@phoenix/components/core/utils";
import { classNames } from "@phoenix/utils/classNames";

import * as Icons from "./Icons";

interface IconBaseProps extends StylableProps, HTMLAttributes<HTMLElement> {
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

interface IconWithSvgProps extends IconBaseProps {
  svg: ReactNode;
  svgKey?: never;
}

interface IconWithKeyProps extends IconBaseProps {
  svg?: never;
  /**
   * The name of an icon exported from Icons (e.g. "CloseOutline", "Search").
   */
  svgKey: keyof typeof Icons;
}

type IconProps = IconWithSvgProps | IconWithKeyProps;

/**
 * Wraps the svg in a reasonable size and applies a color
 */
export const Icon = ({
  svg,
  svgKey,
  isDisabled: _isDisabled,
  color = "inherit",
  css: propsCSS,
  className = "",
  ...restProps
}: IconProps) => {
  let resolvedSvg: ReactNode = svg;
  if (svgKey) {
    const Svg = Icons[svgKey];
    resolvedSvg = <Svg />;
  }
  const resolvedColor = color === "inherit" ? "inherit" : colorValue(color);
  return (
    <i
      className={classNames("icon-wrap", className)}
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
      {resolvedSvg}
    </i>
  );
};
