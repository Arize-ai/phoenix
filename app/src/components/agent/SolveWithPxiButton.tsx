import { css } from "@emotion/react";
import type { Ref } from "react";

import { Button, type ButtonProps } from "@phoenix/components/core/button";
import { classNames } from "@phoenix/utils/classNames";

import { getPxiGlyphSVGDataUrl } from "./PxiGlyph";
import {
  pxiConicBandCSS,
  pxiConicGradientCSS,
  pxiConicSpin,
  pxiGlowBreathe,
  pxiGlowFlashOpacity,
  pxiGlowWipe,
  pxiGlowWipeMaskCSS,
} from "./pxiStyles";

const pxiGlyphMaskImage = `url("${getPxiGlyphSVGDataUrl({ fill: "black" })}")`;

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
  &[data-childless="true"] {
    aspect-ratio: 1 / 1;
  }
  background-image: linear-gradient(
    135deg,
    color-mix(in srgb, var(--pxi-treatment-color-start) 11%, transparent),
    color-mix(in srgb, var(--pxi-treatment-color-end) 7%, transparent)
  );

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    ${pxiConicBandCSS};
    z-index: 1;
    opacity: 0.82;
    animation: ${pxiConicSpin} var(--pxi-conic-spin-duration) linear infinite;
  }

  .solve-with-pxi-button__glow {
    ${pxiGlowWipeMaskCSS};
    position: absolute;
    inset: calc(-1 * var(--pxi-glow-bleed));
    z-index: 0;
    border-radius: inherit;
    pointer-events: none;
  }

  .solve-with-pxi-button__glow::before {
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

  &[data-pxi-should-flash="true"] .solve-with-pxi-button__glow {
    animation: ${pxiGlowWipe} var(--pxi-glow-wipe-duration)
      var(--pxi-glow-wipe-easing) 1;
  }

  &[data-pxi-should-flash="true"] .solve-with-pxi-button__glow::before {
    animation:
      ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out 1,
      ${pxiGlowFlashOpacity} var(--pxi-glow-wipe-duration) linear 1;
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

    .solve-with-pxi-button__glyph {
      &::before {
        animation: none;
      }
    }

    .solve-with-pxi-button__glow,
    .solve-with-pxi-button__glow::before {
      animation: none !important;
    }
  }
`;

const glyphCSS = css`
  display: block;
  flex: none;
  width: 13px;
  height: 13px;
  background: color-mix(
    in srgb,
    var(--pxi-treatment-color-middle) 78%,
    var(--pxi-treatment-color-end)
  );
  -webkit-mask-image: ${pxiGlyphMaskImage};
  mask-image: ${pxiGlyphMaskImage};
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;

  &::before {
    content: "";
    ${pxiConicGradientCSS};
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0.35;
    animation: ${pxiConicSpin} var(--pxi-conic-spin-duration) linear infinite;
  }

  &[data-size="S"] {
    width: 11px;
    height: 11px;
  }
`;

export function SolveWithPxiButton({
  ref,
  className,
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
      className={classNames("solve-with-pxi-button", className)}
      size={size}
      variant={variant}
      aria-label={isButtonIconOnly ? label : buttonProps["aria-label"]}
      data-pxi-should-flash={shouldFlash ? "true" : undefined}
      css={css(pxiButtonCSS, propCSS)}
      leadingVisual={
        <>
          <span className="solve-with-pxi-button__glow" aria-hidden="true" />
          <span
            className="solve-with-pxi-button__glyph"
            css={glyphCSS}
            data-size={size}
            aria-hidden="true"
          />
        </>
      }
    >
      {isButtonIconOnly ? undefined : label}
    </Button>
  );
}
