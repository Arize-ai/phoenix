import { css, keyframes } from "@emotion/react";

import { textBaseCSS } from "../../core/content/styles";

const shimmerKeyframes = keyframes`
  from {
    background-position: 100% center;
  }
  to {
    background-position: 0% center;
  }
`;

/**
 * Two-layer background-clip:text shimmer effect:
 * - Top layer: a narrow transparent→background→transparent spotlight that sweeps across
 * - Bottom layer: solid muted text color as the base appearance
 *
 * The spotlight uses the page background color, creating a high-contrast
 * "wipe" effect (text momentarily flashes to the background color).
 */
export const shimmerBaseCSS = css`
  ${textBaseCSS};
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  background-repeat: no-repeat, padding-box;
  background-image:
    linear-gradient(
      90deg,
      transparent calc(50% - var(--shimmer-spread)),
      var(--global-background-color-default),
      transparent calc(50% + var(--shimmer-spread))
    ),
    linear-gradient(var(--global-text-color-700), var(--global-text-color-700));

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: none;
    -webkit-background-clip: initial;
    background-clip: initial;
    color: var(--global-text-color-900);
  }
`;

export const getShimmerAnimationCSS = (duration: number) => css`
  background-size:
    250% 100%,
    auto;
  animation: ${shimmerKeyframes} ${duration}s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
