import { css } from "@emotion/react";
import type { Ref } from "react";

import { Button, type ButtonProps } from "@phoenix/components/core/button";
import { classNames } from "@phoenix/utils/classNames";

import {
  PxiAnimatedGlyph,
  type PxiAnimatedGlyphSize,
} from "./PxiAnimatedGlyph";
import {
  pxiConicBandCSS,
  pxiConicSpin,
  pxiGlowBreathe,
  pxiGlowFlashOpacity,
  pxiGlowWipe,
  pxiGlowWipeMaskCSS,
} from "./pxiStyles";

export type PxiButtonSize = PxiAnimatedGlyphSize;
export type PxiButtonVariant = "default" | "quiet";

export interface PxiButtonProps extends Omit<
  ButtonProps,
  "children" | "leadingVisual" | "size" | "trailingVisual" | "variant"
> {
  /** Visible label, or accessible name when icon-only. */
  label?: string;
  /** Collapses the button to a square icon button. */
  isIconOnly?: boolean;
  /** Runs the PXI attention glow once when it changes from false to true. */
  shouldFlash?: boolean;
  size?: PxiButtonSize;
  variant?: PxiButtonVariant;
  ref?: Ref<HTMLButtonElement>;
}

const pxiButtonCSS = css`
  --pxi-treatment-stroke-width: var(--global-border-size-thin);
  --pxi-button-background-color-hover: color-mix(
    in srgb,
    var(--pxi-treatment-color-middle) 6%,
    transparent
  );
  position: relative;
  isolation: isolate;
  &[data-childless="true"] {
    aspect-ratio: 1 / 1;
  }
  background-color: transparent;
  background-image: none;

  &:hover:not([disabled]) {
    background-color: var(--pxi-button-background-color-hover);
  }

  &::before {
    content: "";
    position: absolute;
    inset: calc(-1 * var(--pxi-treatment-stroke-width));
    border-radius: inherit;
    pointer-events: none;
    ${pxiConicBandCSS};
    z-index: 1;
    opacity: 0.82;
    animation: ${pxiConicSpin} var(--pxi-conic-spin-duration) linear infinite;
  }

  .pxi-button__glow {
    ${pxiGlowWipeMaskCSS};
    position: absolute;
    inset: calc(-1 * var(--pxi-glow-bleed));
    z-index: 0;
    border-radius: inherit;
    pointer-events: none;
  }

  .pxi-button__glow::before {
    content: "";
    position: absolute;
    inset: var(--pxi-glow-bleed);
    border-radius: inherit;
    box-shadow: var(--pxi-glow-box-shadow-rest);
    opacity: 0;
  }

  &[data-hovered]::before {
    opacity: 1;
  }

  &[data-pressed] {
    filter: brightness(0.98);
  }

  &[data-pxi-should-flash="true"] .pxi-button__glow {
    animation: ${pxiGlowWipe} var(--pxi-glow-wipe-duration)
      var(--pxi-glow-wipe-easing) 1;
  }

  &[data-pxi-should-flash="true"] .pxi-button__glow::before {
    animation:
      ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out 1,
      ${pxiGlowFlashOpacity} var(--pxi-glow-wipe-duration) linear 1;
  }

  &[data-variant="quiet"] {
    &:hover:not([disabled]) {
      background-color: var(--pxi-button-background-color-hover);
    }

    &::before {
      opacity: 0;
    }

    &[data-hovered]::before {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation-play-state: paused;
    }

    .pxi-button__glow,
    .pxi-button__glow::before {
      animation: none !important;
    }
  }
`;

export function PxiButton({
  ref,
  className,
  css: propCSS,
  label = "Solve with PXI",
  isIconOnly = false,
  shouldFlash = false,
  size = "M",
  variant = "default",
  ...buttonProps
}: PxiButtonProps) {
  const isButtonIconOnly = isIconOnly;
  return (
    <Button
      {...buttonProps}
      ref={ref}
      className={classNames("pxi-button", className)}
      size={size}
      variant={variant}
      aria-label={isButtonIconOnly ? label : buttonProps["aria-label"]}
      data-pxi-should-flash={shouldFlash ? "true" : undefined}
      css={css(pxiButtonCSS, propCSS)}
      leadingVisual={
        <>
          <span className="pxi-button__glow" aria-hidden="true" />
          <PxiAnimatedGlyph size={size} />
        </>
      }
    >
      {isButtonIconOnly ? undefined : label}
    </Button>
  );
}
