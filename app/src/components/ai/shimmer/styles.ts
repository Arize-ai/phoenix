import { css, keyframes } from "@emotion/react";

import { textBaseCSS } from "../../core/content/styles";

const shimmerKeyframes = keyframes`
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0 0;
  }
`;

export const shimmerBaseCSS = css`
  ${textBaseCSS};
  background: linear-gradient(
    90deg,
    var(--global-text-color-700),
    var(--global-text-color-900),
    var(--global-text-color-700)
  );
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: none;
    -webkit-background-clip: initial;
    background-clip: initial;
    color: var(--global-text-color-900);
  }
`;

export const getShimmerAnimationCSS = (
  duration: number,
  backgroundSize: string
) => css`
  background-size: ${backgroundSize} 100%;
  animation: ${shimmerKeyframes} ${duration}s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
