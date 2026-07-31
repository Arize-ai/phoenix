import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { StylableProps } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

import {
  pxiConicBandCSS,
  pxiConicSpin,
  pxiContainedGlowBreathe,
  pxiGlowBreathe,
  pxiGlowFlashOpacity,
  pxiGlowWipe,
  pxiGlowWipeMaskCSS,
} from "./pxiStyles";

export type PxiOutlineState = "idle" | "eligible" | "active";
export type PxiOutlineRadius = "small" | "medium";
export type PxiOutlineGlowMode = "outer" | "contained";

export interface PxiOutlineProps extends StylableProps {
  children: ReactNode;
  className?: string;
  /** Expands to the available width instead of shrink-wrapping its child. */
  isFullWidth?: boolean;
  /** Keeps the glow within the target bounds for clipped or tightly packed rows. */
  glowMode?: PxiOutlineGlowMode;
  radius?: PxiOutlineRadius;
  /** Runs one attention flash when an eligible outline changes to true. */
  shouldFlash?: boolean;
  state?: PxiOutlineState;
}

const outlineCSS = css`
  --pxi-treatment-stroke-width: 1.5px;
  --pxi-outline-gap: var(--global-dimension-static-size-25);
  --pxi-outline-target-radius: var(--global-rounding-small);
  position: relative;
  display: inline-grid;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
  isolation: isolate;
  border-radius: var(--pxi-outline-target-radius);

  &[data-full-width="true"] {
    display: grid;
    width: 100%;
  }

  &[data-radius="medium"] {
    --pxi-outline-target-radius: var(--global-rounding-medium);
  }

  .pxi-outline__stroke,
  .pxi-outline__glow {
    position: absolute;
    pointer-events: none;
  }

  .pxi-outline__stroke {
    ${pxiConicBandCSS};
    inset: calc(
      -1 * (var(--pxi-outline-gap) + var(--pxi-treatment-stroke-width))
    );
    z-index: 2;
    border-radius: calc(
      var(--pxi-outline-target-radius) + var(--pxi-outline-gap) +
        var(--pxi-treatment-stroke-width)
    );
    opacity: 0.3;
    animation: ${pxiConicSpin} var(--pxi-conic-spin-duration) linear infinite
      paused;
  }

  .pxi-outline__glow {
    ${pxiGlowWipeMaskCSS};
    inset: calc(
      -1 *
        (var(--pxi-outline-gap) + var(--pxi-treatment-stroke-width) +
          var(--pxi-glow-bleed))
    );
    z-index: 0;
    border-radius: calc(
      var(--pxi-outline-target-radius) + var(--pxi-outline-gap) +
        var(--pxi-treatment-stroke-width)
    );
  }

  .pxi-outline__glow::before {
    content: "";
    position: absolute;
    inset: var(--pxi-glow-bleed);
    border-radius: inherit;
    box-shadow: var(--pxi-glow-box-shadow-rest);
    opacity: 0;
  }

  &[data-state="eligible"] .pxi-outline__stroke {
    opacity: 0.64;
  }

  &[data-state="active"] .pxi-outline__stroke {
    opacity: 1;
    animation-play-state: running;
  }

  &[data-state="active"] .pxi-outline__glow {
    opacity: 1;
    -webkit-mask-image: none;
    mask-image: none;
  }

  &[data-state="active"] .pxi-outline__glow::before {
    opacity: 0.72;
    animation: ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out
      infinite;
  }

  &[data-state="eligible"][data-should-flash="true"] .pxi-outline__glow {
    animation: ${pxiGlowWipe} var(--pxi-glow-wipe-duration)
      var(--pxi-glow-wipe-easing) 1;
  }

  &[data-state="eligible"][data-should-flash="true"]
    .pxi-outline__glow::before {
    animation:
      ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out 1,
      ${pxiGlowFlashOpacity} var(--pxi-glow-wipe-duration) linear 1;
  }

  &[data-glow-mode="contained"] {
    .pxi-outline__stroke {
      inset: 0;
      border-radius: var(--pxi-outline-target-radius);
    }

    .pxi-outline__glow {
      inset: 0;
      border-radius: var(--pxi-outline-target-radius);
    }

    .pxi-outline__glow::before {
      inset: 0;
      box-shadow: var(--pxi-glow-box-shadow-contained-rest);
    }

    &[data-state="active"] .pxi-outline__glow::before {
      animation-name: ${pxiContainedGlowBreathe};
    }

    &[data-state="eligible"][data-should-flash="true"]
      .pxi-outline__glow::before {
      animation-name: ${pxiContainedGlowBreathe}, ${pxiGlowFlashOpacity};
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pxi-outline__stroke {
      animation-play-state: paused;
    }

    .pxi-outline__glow,
    .pxi-outline__glow::before {
      animation: none !important;
    }
  }
`;

export function PxiOutline({
  children,
  className,
  css: propCSS,
  isFullWidth = false,
  glowMode = "outer",
  radius = "small",
  shouldFlash = false,
  state = "idle",
}: PxiOutlineProps) {
  const canFlash = state === "eligible" && shouldFlash;
  return (
    <div
      className={classNames("pxi-outline", className)}
      css={css(outlineCSS, propCSS)}
      data-full-width={isFullWidth ? "true" : undefined}
      data-glow-mode={glowMode}
      data-radius={radius}
      data-should-flash={canFlash ? "true" : undefined}
      data-state={state}
    >
      <span className="pxi-outline__glow" aria-hidden="true" />
      <span className="pxi-outline__stroke" aria-hidden="true" />
      {children}
    </div>
  );
}
