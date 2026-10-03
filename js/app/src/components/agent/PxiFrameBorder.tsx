import { css, keyframes } from "@emotion/react";

import { aiConicBandCSS, aiConicSpin } from "@phoenix/components/ai/glow";
import { APP_FRAME_BORDER_Z_INDEX } from "@phoenix/components/core/zIndex";

export type PxiFrameBorderState = "idle" | "quick" | "long";

export interface PxiFrameBorderProps {
  state: PxiFrameBorderState;
}

const frameBorderGlowBreathe = keyframes`
  0%, 100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
`;

const frameBorderCSS = css`
  position: absolute;
  inset: 0;
  z-index: ${APP_FRAME_BORDER_Z_INDEX};
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  box-shadow: var(--ai-glow-box-shadow-contained-rest);
  /* Visibility flips only after the fade-out so idle stops painting without
     cutting the fade short. */
  transition:
    opacity var(--ai-frame-border-fade-duration) var(--ai-frame-border-easing),
    visibility 0s linear var(--ai-frame-border-fade-duration),
    --pxi-frame-border-intensity var(--ai-frame-border-intensity-duration)
      var(--ai-frame-border-easing);

  &[data-state="quick"],
  &[data-state="long"] {
    opacity: 1;
    visibility: visible;
    transition-delay: 0s;
  }

  &[data-state="long"] {
    --pxi-frame-border-intensity: 1;
  }

  .pxi-frame-border__band,
  .pxi-frame-border__glow,
  .pxi-frame-border__glow::before {
    position: absolute;
    inset: 0;
  }

  .pxi-frame-border__band {
    --ai-conic-band-stroke-width: calc(
      2px + 1px * var(--pxi-frame-border-intensity)
    );
    ${aiConicBandCSS};
    opacity: calc(0.55 + 0.45 * var(--pxi-frame-border-intensity));
    animation: ${aiConicSpin} var(--ai-frame-border-spin-duration) linear
      infinite;
  }

  .pxi-frame-border__glow {
    opacity: var(--pxi-frame-border-intensity);
  }

  /* Breathes opacity over a static shadow — animating box-shadow would
     repaint a viewport-sized layer every frame. */
  .pxi-frame-border__glow::before {
    content: "";
    box-shadow: var(--ai-glow-box-shadow-contained-strong);
    animation: ${frameBorderGlowBreathe} var(--ai-glow-wipe-duration)
      ease-in-out infinite;
  }

  &[data-state="idle"] .pxi-frame-border__band,
  &[data-state="idle"] .pxi-frame-border__glow::before {
    animation-play-state: paused;
  }

  @media (prefers-reduced-motion: reduce) {
    .pxi-frame-border__band {
      animation-play-state: paused;
    }

    .pxi-frame-border__glow::before {
      animation: none !important;
    }
  }
`;

/**
 * An animated border framing the application viewport while PXI runs a
 * browser-action script against the page.
 */
export function PxiFrameBorder({ state }: PxiFrameBorderProps) {
  return (
    <div
      className="pxi-frame-border"
      css={frameBorderCSS}
      data-state={state}
      aria-hidden="true"
    >
      <span className="pxi-frame-border__glow" />
      <span className="pxi-frame-border__band" />
    </div>
  );
}
