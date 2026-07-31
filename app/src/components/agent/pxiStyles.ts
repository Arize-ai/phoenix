import { css, keyframes } from "@emotion/react";

export const pxiConicSpin = keyframes`
  to {
    --pxi-conic-angle: 405deg;
  }
`;

export const pxiGlowBreathe = keyframes`
  0%, 100% {
    box-shadow: var(--pxi-glow-box-shadow-rest);
  }
  50% {
    box-shadow: var(--pxi-glow-box-shadow-strong);
  }
`;

export const pxiThinkingGlowWipe = keyframes`
  0% {
    -webkit-mask-position: 170% center;
    mask-position: 170% center;
  }

  100% {
    -webkit-mask-position: -70% center;
    mask-position: -70% center;
  }
`;

export const pxiContainedGlowBreathe = keyframes`
  0%, 100% {
    box-shadow: var(--pxi-glow-box-shadow-contained-rest);
  }
  50% {
    box-shadow: var(--pxi-glow-box-shadow-contained-strong);
  }
`;

export const pxiGlowWipe = keyframes`
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

export const pxiGlowFlashOpacity = keyframes`
  0%, 100% {
    opacity: 0;
  }
  8%, 40% {
    opacity: var(--pxi-glow-opacity);
  }
  55% {
    opacity: 0;
  }
`;

export const pxiGlowWipeMaskCSS = css`
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

export const pxiConicGradientCSS = css`
  background: conic-gradient(
    from var(--pxi-conic-angle),
    var(--pxi-treatment-color-start),
    var(--pxi-treatment-color-middle),
    var(--pxi-treatment-color-end),
    var(--pxi-treatment-color-start)
  );
`;

/** A conic-gradient band whose thickness is controlled by the caller. */
export const pxiConicBandCSS = css`
  ${pxiConicGradientCSS};
  padding: var(--pxi-treatment-stroke-width);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
`;
