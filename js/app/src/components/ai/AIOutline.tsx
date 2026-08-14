import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  aiConicBandCSS,
  aiConicSpin,
  aiGlowBreatheContained,
  aiGlowBreathe,
  aiGlowFlashOpacity,
  aiGlowWipe,
  aiGlowWipeContinuousCSS,
  aiGlowWipeMaskCSS,
} from "@phoenix/components/ai/glow";
import type { StylableProps } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

export type AIOutlineState = "idle" | "eligible" | "active";
export type AIOutlineRadius = "small" | "medium";
export type AIOutlineGlowMode = "outer" | "contained";

export interface AIOutlineProps extends StylableProps {
  children: ReactNode;
  className?: string;
  /** Expands to the available width instead of shrink-wrapping its child. */
  isFullWidth?: boolean;
  /** Keeps the glow within the target bounds for clipped or tightly packed rows. */
  glowMode?: AIOutlineGlowMode;
  radius?: AIOutlineRadius;
  /** Runs one attention flash when an eligible outline changes to true. */
  shouldFlash?: boolean;
  state?: AIOutlineState;
}

const outlineCSS = css`
  --ai-conic-band-stroke-width: 1.5px;
  --ai-outline-gap: var(--global-dimension-static-size-25);
  --ai-outline-target-radius: var(--global-rounding-small);
  position: relative;
  display: inline-grid;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
  isolation: isolate;
  border-radius: var(--ai-outline-target-radius);

  &[data-full-width="true"] {
    display: grid;
    width: 100%;
  }

  &[data-radius="medium"] {
    --ai-outline-target-radius: var(--global-rounding-medium);
  }

  .ai-outline__stroke,
  .ai-outline__glow {
    position: absolute;
    pointer-events: none;
  }

  .ai-outline__stroke {
    ${aiConicBandCSS};
    inset: calc(
      -1 * (var(--ai-outline-gap) + var(--ai-conic-band-stroke-width))
    );
    z-index: 2;
    border-radius: calc(
      var(--ai-outline-target-radius) + var(--ai-outline-gap) +
        var(--ai-conic-band-stroke-width)
    );
    opacity: 0.3;
    animation: ${aiConicSpin} var(--ai-conic-spin-duration) linear infinite
      paused;
  }

  .ai-outline__glow {
    ${aiGlowWipeMaskCSS};
    inset: calc(
      -1 *
        (var(--ai-outline-gap) + var(--ai-conic-band-stroke-width) +
          var(--ai-glow-bleed))
    );
    z-index: 0;
    border-radius: calc(
      var(--ai-outline-target-radius) + var(--ai-outline-gap) +
        var(--ai-conic-band-stroke-width)
    );
  }

  .ai-outline__glow::before {
    content: "";
    position: absolute;
    inset: var(--ai-glow-bleed);
    border-radius: inherit;
    box-shadow: var(--ai-glow-box-shadow-rest);
    opacity: 0;
  }

  /* Eligible keeps the band's subtle rotation running at resting opacity
     so an engaged-but-idle target still reads as alive */
  &[data-state="eligible"] .ai-outline__stroke {
    opacity: 0.64;
    animation-play-state: running;
  }

  &[data-state="active"] .ai-outline__stroke {
    opacity: 1;
    animation-play-state: running;
  }

  /* Active gets the thinking glow: the breathing glow clipped by the
     traveling wipe, matching PxiButton's working state */
  &[data-state="active"] .ai-outline__glow {
    opacity: 1;
    ${aiGlowWipeContinuousCSS};
  }

  &[data-state="active"] .ai-outline__glow::before {
    opacity: 0.72;
    animation: ${aiGlowBreathe} var(--ai-glow-wipe-duration) ease-in-out
      infinite;
  }

  &[data-state="eligible"][data-should-flash="true"] .ai-outline__glow {
    animation: ${aiGlowWipe} var(--ai-glow-wipe-duration)
      var(--ai-glow-wipe-easing) 1;
  }

  &[data-state="eligible"][data-should-flash="true"] .ai-outline__glow::before {
    animation:
      ${aiGlowBreathe} var(--ai-glow-wipe-duration) ease-in-out 1,
      ${aiGlowFlashOpacity} var(--ai-glow-wipe-duration) linear 1;
  }

  &[data-glow-mode="contained"] {
    .ai-outline__stroke {
      inset: 0;
      border-radius: var(--ai-outline-target-radius);
    }

    .ai-outline__glow {
      inset: 0;
      border-radius: var(--ai-outline-target-radius);
    }

    .ai-outline__glow::before {
      inset: 0;
      box-shadow: var(--ai-glow-box-shadow-contained-rest);
    }

    &[data-state="active"] .ai-outline__glow::before {
      animation-name: ${aiGlowBreatheContained};
    }

    &[data-state="eligible"][data-should-flash="true"]
      .ai-outline__glow::before {
      animation-name: ${aiGlowBreatheContained}, ${aiGlowFlashOpacity};
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-outline__stroke {
      animation-play-state: paused;
    }

    .ai-outline__glow,
    .ai-outline__glow::before {
      animation: none !important;
    }
  }
`;

export function AIOutline({
  children,
  className,
  css: propCSS,
  isFullWidth = false,
  glowMode = "outer",
  radius = "small",
  shouldFlash = false,
  state = "idle",
}: AIOutlineProps) {
  const canFlash = state === "eligible" && shouldFlash;
  // The outline re-renders with its child (per keystroke when wrapping an
  // input) — don't re-serialize the composed styles each time
  const composedCSS = useMemo(() => css(outlineCSS, propCSS), [propCSS]);
  return (
    <div
      className={classNames("ai-outline", className)}
      css={composedCSS}
      data-full-width={isFullWidth ? "true" : undefined}
      data-glow-mode={glowMode}
      data-radius={radius}
      data-should-flash={canFlash ? "true" : undefined}
      data-state={state}
    >
      <span className="ai-outline__glow" aria-hidden="true" />
      <span className="ai-outline__stroke" aria-hidden="true" />
      {children}
    </div>
  );
}
