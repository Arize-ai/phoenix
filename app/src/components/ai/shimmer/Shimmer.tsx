import { motion, type MotionProps, useReducedMotion } from "motion/react";
import React, { type JSX } from "react";

import { getTextColor } from "@phoenix/components/core/content/textUtils";
import { classNames } from "@phoenix/utils/classNames";

import { shimmerBaseCSS } from "./styles";
import type { ShimmerProps } from "./types";

type IntrinsicTag = keyof JSX.IntrinsicElements;
type MotionTagComponent = React.ComponentType<
  MotionProps & Record<string, unknown>
>;

// motion.create(tag) is pure per tag — cache so we don't rebuild the component
// on every render of Shimmer.
const motionComponentCache = new Map<IntrinsicTag, MotionTagComponent>();

const getMotionComponent = (element: IntrinsicTag): MotionTagComponent => {
  const cached = motionComponentCache.get(element);
  if (cached) return cached;
  const component = motion.create(element) as MotionTagComponent;
  motionComponentCache.set(element, component);
  return component;
};

export function Shimmer({
  ref,
  children,
  elementType = "p",
  size = "S",
  weight = "normal",
  color = "text-700",
  fontStyle = "normal",
  duration = 2,
  spread = 2,
  className,
  style,
  ...restProps
}: ShimmerProps & { ref?: React.Ref<HTMLElement> }) {
  const shouldReduceMotion = useReducedMotion();
  const MotionComponent = getMotionComponent(elementType as IntrinsicTag);
  const dynamicSpread = (children?.length ?? 0) * spread;

  // When the user prefers reduced motion, skip Motion entirely; the @media
  // block in styles.ts then renders solid text.
  const animationProps: MotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { backgroundPosition: "100% center" },
        animate: { backgroundPosition: "0% center" },
        transition: {
          duration,
          ease: "linear",
          repeat: Number.POSITIVE_INFINITY,
        },
      };

  return (
    <MotionComponent
      ref={ref}
      className={classNames("shimmer", className)}
      data-size={size}
      data-weight={weight}
      css={shimmerBaseCSS}
      style={
        {
          "--shimmer-spread": `${dynamicSpread}px`,
          "--shimmer-color": getTextColor(color),
          fontStyle,
          ...style,
        } as React.CSSProperties
      }
      {...animationProps}
      // HTMLAttributes.onAnimationStart collides with MotionProps' — cast so
      // consumer HTML props pass through.
      {...(restProps as Record<string, unknown>)}
    >
      {children}
    </MotionComponent>
  );
}

Shimmer.displayName = "Shimmer";
