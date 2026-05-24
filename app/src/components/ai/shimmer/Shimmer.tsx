import React, { type JSX } from "react";
import { motion, type MotionProps, useReducedMotion } from "motion/react";

import { classNames } from "@phoenix/utils/classNames";

import { shimmerBaseCSS } from "./styles";
import type { ShimmerProps } from "./types";

type IntrinsicTag = keyof JSX.IntrinsicElements;
type MotionTagComponent = React.ComponentType<
  MotionProps & Record<string, unknown>
>;

// Cache motion components at module level so we don't recreate them per render.
const motionComponentCache = new Map<IntrinsicTag, MotionTagComponent>();

const getMotionComponent = (element: IntrinsicTag): MotionTagComponent => {
  let component = motionComponentCache.get(element);
  if (!component) {
    component = motion.create(element) as MotionTagComponent;
    motionComponentCache.set(element, component);
  }
  return component;
};

export function Shimmer({
  ref,
  children,
  elementType = "p",
  size = "S",
  weight = "normal",
  duration = 2,
  spread = 2,
  className,
  style,
  ...restProps
}: ShimmerProps & { ref?: React.Ref<HTMLElement> }) {
  const shouldReduceMotion = useReducedMotion();
  const dynamicSpread = (children?.length ?? 0) * spread;
  const MotionComponent = getMotionComponent(elementType as IntrinsicTag);

  return (
    <MotionComponent
      ref={ref as React.Ref<never>}
      className={classNames("shimmer", className)}
      data-size={size}
      data-weight={weight}
      css={shimmerBaseCSS}
      style={
        {
          "--shimmer-spread": `${dynamicSpread}px`,
          ...style,
        } as React.CSSProperties
      }
      initial={
        shouldReduceMotion ? undefined : { backgroundPosition: "100% center" }
      }
      animate={
        shouldReduceMotion ? undefined : { backgroundPosition: "0% center" }
      }
      transition={
        shouldReduceMotion
          ? undefined
          : {
              duration,
              ease: "linear",
              repeat: Number.POSITIVE_INFINITY,
            }
      }
      {...(restProps as Record<string, unknown>)}
    >
      {children}
    </MotionComponent>
  );
}

Shimmer.displayName = "Shimmer";
