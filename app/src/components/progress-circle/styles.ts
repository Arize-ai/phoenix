import { css, keyframes } from "@emotion/react";

import type { Size } from "./types";

export const SIZES = {
  S: 18,
  M: 32,
};

export const STROKE_WIDTHS = {
  S: 2,
  M: 3,
};

export const CENTER = (size: Size) => SIZES[size] / 2;
export const RADIUS = (size: Size) => SIZES[size] / 2 - STROKE_WIDTHS[size];
export const CIRCUMFERENCE = (size: Size) => 2 * Math.PI * RADIUS(size);
export const DASH_SHORT = (size: Size) => CIRCUMFERENCE(size) * 0.25;
export const DASH_LONG = (size: Size) => CIRCUMFERENCE(size) * 0.75;

// Keyframes for spinning the arc
const spin = keyframes`
  100% {
    transform: rotate(360deg);
  }
`;

// Keyframes for animating the arc length (dasharray)
const dash = (size: Size) => keyframes`
  0% {
    stroke-dasharray: ${DASH_SHORT(size)}, ${CIRCUMFERENCE(size)};
    stroke-dashoffset: 0;
  }
  80% {
    stroke-dasharray: ${DASH_LONG(size)}, ${CIRCUMFERENCE(size)};
    stroke-dashoffset: ${-1 * CIRCUMFERENCE(size)};
  }
  100% {
    stroke-dasharray: ${DASH_SHORT(size)}, ${CIRCUMFERENCE(size)};
    stroke-dashoffset: ${-1 * CIRCUMFERENCE(size) * 1.25};
  }
`;

export const progressCircleIndeterminateCSS = (size: Size) => css`
  .progress-circle__svg {
    animation: ${spin} 3s linear infinite;
  }
  .progress-circle__arc {
    animation: ${dash(size)} 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
`;
