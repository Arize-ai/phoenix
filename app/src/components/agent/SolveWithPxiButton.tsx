import { css } from "@emotion/react";
import type { Ref } from "react";

import { Button, type ButtonProps } from "@phoenix/components/core/button";

import { PxiGlyph } from "./PxiGlyph";
import { pxiConicBandCSS, pxiConicSpin, pxiOuterGlowFlash } from "./pxiStyles";

export type SolveWithPxiButtonSize = "S" | "M";
export type SolveWithPxiButtonVariant = "default" | "quiet";

export interface SolveWithPxiButtonProps extends Omit<
  ButtonProps,
  "children" | "leadingVisual" | "size" | "trailingVisual" | "variant"
> {
  /** Visible label, or accessible name when icon-only. */
  label?: string;
  /** Collapses the default variant to a square icon button. */
  isIconOnly?: boolean;
  /** Runs the PXI attention glow once when it changes from false to true. */
  shouldFlash?: boolean;
  size?: SolveWithPxiButtonSize;
  variant?: SolveWithPxiButtonVariant;
  ref?: Ref<HTMLButtonElement>;
}

const pxiButtonCSS = css`
  --pxi-treatment-stroke-width: var(--global-border-size-thin);
  position: relative;
  isolation: isolate;
  background-image: linear-gradient(
    135deg,
    color-mix(in srgb, var(--pxi-treatment-color-start) 11%, transparent),
    color-mix(in srgb, var(--pxi-treatment-color-end) 7%, transparent)
  );

  &::before,
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
  }

  &::before {
    ${pxiConicBandCSS};
    z-index: 1;
    opacity: 0.82;
    animation: ${pxiConicSpin} 3s linear infinite paused;
  }

  &::after {
    z-index: -1;
    opacity: 0;
  }

  &[data-hovered]::before {
    opacity: 1;
    animation-play-state: running;
  }

  &[data-pressed] {
    filter: brightness(0.98);
  }

  &[data-pxi-should-flash="true"]::after {
    animation: ${pxiOuterGlowFlash} 2400ms ease-in-out 1 both;
  }

  &[data-variant="quiet"] {
    background-image: none;

    &::before {
      opacity: 0;
    }

    &[data-hovered]::before {
      opacity: 0.9;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation-play-state: paused;
    }

    &::after {
      animation: none !important;
    }
  }
`;

const glyphCSS = css`
  display: inline-flex;
  flex: none;
  color: var(--pxi-treatment-color-middle);
`;

export function SolveWithPxiButton({
  ref,
  css: propCSS,
  label = "Solve with PXI",
  isIconOnly = false,
  shouldFlash = false,
  size = "M",
  variant = "default",
  ...buttonProps
}: SolveWithPxiButtonProps) {
  const isButtonIconOnly = variant === "quiet" || isIconOnly;
  return (
    <Button
      {...buttonProps}
      ref={ref}
      size={size}
      variant={variant}
      aria-label={isButtonIconOnly ? label : buttonProps["aria-label"]}
      data-pxi-should-flash={shouldFlash ? "true" : undefined}
      css={css(pxiButtonCSS, propCSS)}
      leadingVisual={
        <span css={glyphCSS} aria-hidden="true">
          <PxiGlyph size={size === "S" ? 11 : 13} />
        </span>
      }
    >
      {isButtonIconOnly ? undefined : label}
    </Button>
  );
}
