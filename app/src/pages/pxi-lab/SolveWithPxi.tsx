import type { ReactNode, Ref } from "react";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components";

import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";
import { classNames } from "@phoenix/utils/classNames";

import type { PxiRingState } from "./pxiLabConfig";

/**
 * The Solve-with-PXI affordance family. Structure only — all paint is driven
 * by `pxiScopeCSS` (solveWithPxiStyles.ts) via class names and data
 * attributes, so a treatment change never touches these components.
 */

export interface SolveWithPxiButtonProps extends Omit<
  AriaButtonProps,
  "children" | "className"
> {
  /**
   * primary = inverted-button call-to-action, gradient-ringed & haloed;
   * secondary = bordered, subtly-tinted normal action;
   * quiet = icon-only toolbar form
   */
  variant?: "primary" | "secondary" | "quiet";
  size?: "S" | "M";
  /**
   * Render only the glyph, no text (label becomes the accessible name).
   * `quiet` is always icon-only; primary/secondary can opt in to keep their
   * border/fill treatment while collapsing to a square icon button.
   */
  iconOnly?: boolean;
  /** visible label / accessible name when icon-only */
  label?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function SolveWithPxiButton({
  variant = "primary",
  size = "M",
  iconOnly = false,
  label = "Solve with PXI",
  ref,
  ...props
}: SolveWithPxiButtonProps) {
  const isIconOnly = variant === "quiet" || iconOnly;
  return (
    <AriaButton
      ref={ref}
      className="pxi-solve-button"
      data-pxi-variant={variant}
      data-size={size}
      data-icon-only={isIconOnly ? "true" : undefined}
      aria-label={isIconOnly ? label : undefined}
      {...props}
    >
      <span className="pxi-solve-button__glyph" aria-hidden="true">
        <PxiGlyph size={size === "S" ? 11 : 13} />
      </span>
      {!isIconOnly && <span>{label}</span>}
    </AriaButton>
  );
}

export interface PxiRingProps {
  /**
   * idle = present but dormant; eligible = inviting attention;
   * active = PXI is currently working on this element
   */
  state?: PxiRingState;
  className?: string;
  children: ReactNode;
}

/**
 * Decorator that marks an arbitrary element as AI-enabled. Renders the ring
 * outside the child's box (negative inset pseudo-elements), so wrapping never
 * shifts layout — safe around components like Card/View/Toolbar that don't
 * accept css/className passthrough.
 */
export function PxiRing({ state = "idle", className, children }: PxiRingProps) {
  return (
    <div className={classNames("pxi-ring", className)} data-pxi-state={state}>
      {/* Glow carrier: the masked band lives on this element's ::before and the
          blur on the element itself, so the mask clips before the blur runs
          (a single element always blurs before it masks, re-hardening the
          edge). Purely decorative. */}
      <span className="pxi-ring__glow" aria-hidden="true" />
      {children}
    </div>
  );
}

/** Inline provenance marker for AI-produced or AI-explainable content. */
export function PxiTag({ children = "PXI" }: { children?: ReactNode }) {
  return (
    <span className="pxi-tag">
      <span className="pxi-tag__glyph" aria-hidden="true">
        <PxiGlyph size={9} />
      </span>
      {children}
    </span>
  );
}

export interface PxiHoverRevealProps {
  /** the affordance that materializes on hover/focus-within */
  reveal: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Host wrapper that reveals its affordance on hover or focus-within.
 * Mirrors the messageToolbarCSS technique: keyboard focus reveals it, touch
 * devices always show it, reduced motion drops the fade.
 */
export function PxiHoverReveal({
  reveal,
  className,
  children,
}: PxiHoverRevealProps) {
  return (
    <div className={classNames("pxi-hover-reveal", className)}>
      {children}
      <span className="pxi-hover-reveal__affordance">{reveal}</span>
    </div>
  );
}
