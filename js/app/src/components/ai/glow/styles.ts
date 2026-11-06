import { css, keyframes } from "@emotion/react";

/**
 * The shared "AI is working" glow: a spinning conic-gradient band, a
 * breathing box-shadow glow, and a traveling glow wipe.
 *
 * These primitives are domain-free — they read only `--ai-*` tokens defined in
 * `GlobalStyles.tsx` (`aiTokensCSS`, plus the `@property --ai-conic-angle`
 * rule), so any AI surface can compose them. Callers supply their own
 * geometry (inset, border-radius, stroke width) and may override the tokens
 * locally to retune the glow for a given surface.
 */

/**
 * Drives `--ai-conic-angle` a full turn (45deg → 405deg) so a conic gradient
 * appears to rotate. Requires the registered `@property --ai-conic-angle`,
 * without which the angle is not interpolatable.
 */
export const aiConicSpin = keyframes`
  to {
    --ai-conic-angle: 405deg;
  }
`;

/** Pulses an outer glow between its rest and strong box-shadow tokens. */
export const aiGlowBreathe = keyframes`
  0%, 100% {
    box-shadow: var(--ai-glow-box-shadow-rest);
  }
  50% {
    box-shadow: var(--ai-glow-box-shadow-strong);
  }
`;

/**
 * Sweeps a glow mask right-to-left without fading, for the continuous
 * "thinking" state. Pair with {@link aiGlowWipeMaskCSS} and an opacity of 1.
 */
export const aiGlowWipeContinuous = keyframes`
  0% {
    -webkit-mask-position: 170% center;
    mask-position: 170% center;
  }

  100% {
    -webkit-mask-position: -70% center;
    mask-position: -70% center;
  }
`;

/**
 * {@link aiGlowBreathe} for glows drawn inside the target bounds, using the
 * inset `contained` box-shadow tokens.
 */
export const aiGlowBreatheContained = keyframes`
  0%, 100% {
    box-shadow: var(--ai-glow-box-shadow-contained-rest);
  }
  50% {
    box-shadow: var(--ai-glow-box-shadow-contained-strong);
  }
`;

/**
 * One-shot attention wipe: fades the masked glow in, travels it across the
 * surface, then fades it back out. Pair with {@link aiGlowWipeMaskCSS}.
 */
export const aiGlowWipe = keyframes`
  0% {
    opacity: 0;
    -webkit-mask-position: 200% center;
    mask-position: 200% center;
  }
  8% {
    opacity: 1;
  }
  40% {
    opacity: 1;
  }
  55% {
    opacity: 0;
    -webkit-mask-position: -60% center;
    mask-position: -60% center;
  }
  100% {
    opacity: 0;
    -webkit-mask-position: -60% center;
    mask-position: -60% center;
  }
`;

/**
 * Opacity envelope matching {@link aiGlowWipe}'s timing, for the glow layer
 * underneath the mask so a one-shot flash fades in and out with the wipe.
 */
export const aiGlowFlashOpacity = keyframes`
  0%, 100% {
    opacity: 0;
  }
  8%, 40% {
    opacity: var(--ai-glow-opacity);
  }
  55% {
    opacity: 0;
  }
`;

/**
 * The masked, additively blended layer that {@link aiGlowWipe} and
 * {@link aiGlowWipeContinuous} travel across. Starts hidden and off-surface;
 * the caller owns positioning and border-radius.
 */
export const aiGlowWipeMaskCSS = css`
  opacity: 0;
  mix-blend-mode: plus-lighter;
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 15%,
    black 45%,
    black 55%,
    transparent 85%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 15%,
    black 45%,
    black 55%,
    transparent 85%
  );
  -webkit-mask-size: 200% 200%;
  mask-size: 200% 200%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: 200% center;
  mask-position: 200% center;
`;

/**
 * The traveling-light pass of the "thinking" state: centers the wipe mask on
 * an {@link aiGlowWipeMaskCSS} layer and sweeps it continuously. Shared by
 * every surface that shows the working glow so the velocity and phase stay
 * identical across them.
 */
export const aiGlowWipeContinuousCSS = css`
  -webkit-mask-position: center;
  mask-position: center;
  animation: ${aiGlowWipeContinuous} var(--ai-glow-wipe-continuous-duration)
    linear infinite both var(--ai-glow-wipe-continuous-delay);
`;

/**
 * The AI gradient as a conic fill. Animate with {@link aiConicSpin} to make
 * it rotate.
 */
export const aiConicGradientCSS = css`
  background: conic-gradient(
    from var(--ai-conic-angle),
    var(--ai-gradient-color-start),
    var(--ai-gradient-color-middle),
    var(--ai-gradient-color-end),
    var(--ai-gradient-color-start)
  );
`;

/** A conic-gradient band whose thickness is controlled by the caller. */
export const aiConicBandCSS = css`
  ${aiConicGradientCSS};
  padding: var(--ai-conic-band-stroke-width);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
`;
