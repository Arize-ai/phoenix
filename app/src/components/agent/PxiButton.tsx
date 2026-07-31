import { css } from "@emotion/react";
import type { Ref } from "react";

import { Button, type ButtonProps } from "@phoenix/components/core/button";
import { classNames } from "@phoenix/utils/classNames";

import {
  PxiAnimatedGlyph,
  type PxiAnimatedGlyphSize,
} from "./PxiAnimatedGlyph";
import { PxiGlyph } from "./PxiGlyph";
import {
  pxiConicBandCSS,
  pxiConicSpin,
  pxiGlowBreathe,
  pxiGlowFlashOpacity,
  pxiGlowWipe,
  pxiGlowWipeMaskCSS,
  pxiThinkingGlowWipe,
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
  /** Shows the continuous PXI thinking treatment and working label. */
  isThinking?: boolean;
  /**
   * Runs the PXI attention glow once when it changes from false to true. The
   * attribute does not self-reset: the owner must clear it via `onFlashEnd`
   * before a later flash can retrigger.
   */
  shouldFlash?: boolean;
  /** Called when the attention glow finishes so the owner can reset `shouldFlash`. */
  onFlashEnd?: () => void;
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

    &:hover:not([disabled])::before,
    &[data-hovered]::before,
    &[data-focus-visible]::before {
      opacity: 1;
    }
  }

  &[data-pxi-is-thinking="true"] {
    background-color: var(--pxi-button-background-color-hover);

    &::before {
      opacity: 1;
    }

    .pxi-button__glow {
      opacity: 1;
      -webkit-mask-position: center;
      mask-position: center;
      animation: ${pxiThinkingGlowWipe} 3600ms linear infinite both -0.5s;
    }

    .pxi-button__glow::before {
      opacity: 1;
      animation: ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out
        infinite;
    }

    .pxi-button__thinking-glyph {
      color: color-mix(
        in srgb,
        var(--pxi-treatment-color-middle) 78%,
        var(--pxi-treatment-color-end)
      );
    }

    .pxi-button__label {
      color: var(--global-text-color-500);
      font-style: italic;
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

    .pxi-button__thinking-glyph > span {
      opacity: 0.65;
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
  isThinking = false,
  shouldFlash = false,
  onFlashEnd,
  size = "M",
  variant = "default",
  ...buttonProps
}: PxiButtonProps) {
  const isButtonIconOnly = isIconOnly;
  const buttonLabel = isThinking ? "Working..." : label;
  const thinkingGlyphSize = size === "S" ? 11 : 13;
  return (
    <Button
      {...buttonProps}
      onAnimationEnd={(event) => {
        buttonProps.onAnimationEnd?.(event);
        // animationend events from the button's other treatments (glyph,
        // conic band) bubble here too; only the glow wipe ends the flash.
        if (event.animationName === pxiGlowWipe.name) {
          onFlashEnd?.();
        }
      }}
      ref={ref}
      className={classNames("pxi-button", className)}
      size={size}
      variant={variant}
      aria-label={isButtonIconOnly ? buttonLabel : buttonProps["aria-label"]}
      data-pxi-is-thinking={isThinking ? "true" : undefined}
      data-pxi-should-flash={shouldFlash ? "true" : undefined}
      css={css(pxiButtonCSS, propCSS)}
      leadingVisual={
        <>
          <span className="pxi-button__glow" aria-hidden="true" />
          {isThinking ? (
            <PxiGlyph
              className="pxi-button__thinking-glyph"
              animation="wave-reveal"
              size={thinkingGlyphSize}
            />
          ) : (
            <PxiAnimatedGlyph size={size} />
          )}
        </>
      }
    >
      {isButtonIconOnly ? undefined : (
        <span className="pxi-button__label">{buttonLabel}</span>
      )}
    </Button>
  );
}
