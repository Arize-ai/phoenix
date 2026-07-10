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

export const pxiContainedGlowBreathe = keyframes`
  0%, 100% {
    box-shadow: var(--pxi-glow-box-shadow-contained-rest);
  }
  50% {
    box-shadow: var(--pxi-glow-box-shadow-contained-strong);
  }
`;

export const pxiOuterGlowFlash = keyframes`
  0%, 100% {
    opacity: 0;
    box-shadow: var(--pxi-glow-box-shadow-rest);
  }
  12%, 42% {
    opacity: 0.95;
    box-shadow: var(--pxi-glow-box-shadow-strong);
  }
`;

export const pxiContainedGlowFlash = keyframes`
  0%, 100% {
    opacity: 0;
    box-shadow: var(--pxi-glow-box-shadow-contained-rest);
  }
  12%, 42% {
    opacity: 1;
    box-shadow: var(--pxi-glow-box-shadow-contained-strong);
  }
`;

/** A conic-gradient band whose thickness is controlled by the caller. */
export const pxiConicBandCSS = css`
  padding: var(--pxi-treatment-stroke-width);
  background: conic-gradient(
    from var(--pxi-conic-angle),
    var(--pxi-treatment-color-start),
    var(--pxi-treatment-color-middle),
    var(--pxi-treatment-color-end),
    var(--pxi-treatment-color-start)
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
`;
