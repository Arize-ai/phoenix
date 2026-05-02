import React from "react";

import { classNames } from "@phoenix/utils/classNames";

import { getShimmerAnimationCSS, shimmerBaseCSS } from "./styles";
import type { ShimmerProps } from "./types";

export function Shimmer({
  ref,
  children,
  elementType: Element = "p",
  size = "S",
  weight = "normal",
  duration = 2,
  spread = 2,
  className,
  style,
  ...restProps
}: ShimmerProps & { ref?: React.Ref<HTMLElement> }) {
  const dynamicSpread = (children?.length ?? 0) * spread;

  return (
    <Element
      ref={ref as React.Ref<never>}
      className={classNames("shimmer", className)}
      data-size={size}
      data-weight={weight}
      css={[shimmerBaseCSS, getShimmerAnimationCSS(duration)]}
      style={
        {
          "--shimmer-spread": `${dynamicSpread}px`,
          ...style,
        } as React.CSSProperties
      }
      {...restProps}
    >
      {children}
    </Element>
  );
}

Shimmer.displayName = "Shimmer";
