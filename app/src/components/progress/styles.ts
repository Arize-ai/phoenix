import { css, keyframes } from "@emotion/react";

// Keyframes for spinning the arc
const spin = keyframes`
  100% {
    transform: rotate(360deg);
  }
`;

// Keyframes for animating the arc length (dasharray) in indeterminate mode
const dash = keyframes`
  0% {
    stroke-dasharray: calc(var(--progress-circle-circumference) * 0.25), var(--progress-circle-circumference);
    stroke-dashoffset: 0;
  }
  80% {
    stroke-dasharray: calc(var(--progress-circle-circumference) * 0.75), var(--progress-circle-circumference);
    stroke-dashoffset: calc(-1 * var(--progress-circle-circumference));
  }
  100% {
    stroke-dasharray: calc(var(--progress-circle-circumference) * 0.25), var(--progress-circle-circumference);
    stroke-dashoffset: calc(-1.25 * var(--progress-circle-circumference));
  }
`;

export const progressCircleCSS = css`
  &[data-size="S"] {
    --progress-circle-size: 18px;
    --progress-circle-stroke-width: 2px;
  }
  &[data-size="M"] {
    --progress-circle-size: 32px;
    --progress-circle-stroke-width: 3px;
  }

  --progress-circle-center: calc(var(--progress-circle-size) / 2);
  --progress-circle-radius: calc(
    var(--progress-circle-center) - var(--progress-circle-stroke-width)
  );
  --progress-circle-circumference: calc(
    2 * 3.141592653589793 * var(--progress-circle-radius)
  );

  // Progress calculations for determinate mode
  --progress-circle-value: 0;
  --progress-circle-dasharray: var(--progress-circle-circumference)
    var(--progress-circle-circumference);
  --progress-circle-dashoffset: calc(
    var(--progress-circle-circumference) -
      (
        var(--progress-circle-value) / 100 *
          var(--progress-circle-circumference)
      )
  );

  .progress-circle__svg {
    width: var(--progress-circle-size);
    height: var(--progress-circle-size);
    fill: none;
    display: block;
  }

  .progress-circle__background {
    cx: var(--progress-circle-center);
    cy: var(--progress-circle-center);
    r: var(--progress-circle-radius);
    stroke: var(--ac-global-color-grey-300);
    stroke-width: var(--progress-circle-stroke-width);
  }

  .progress-circle__arc {
    cx: var(--progress-circle-center);
    cy: var(--progress-circle-center);
    r: var(--progress-circle-radius);
    stroke: var(--ac-global-color-primary);
    stroke-width: var(--progress-circle-stroke-width);
    transition: stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    stroke-dasharray: var(--progress-circle-dasharray);
    stroke-dashoffset: var(--progress-circle-dashoffset);
  }

  &[data-indeterminate] {
    .progress-circle__svg {
      animation: ${spin} 3s linear infinite;
    }
    .progress-circle__arc {
      animation: ${dash} 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      stroke-dasharray: calc(var(--progress-circle-circumference) * 0.25),
        var(--progress-circle-circumference);
      stroke-dashoffset: 0;
    }
  }
`;

export const progressBarCSS = css`
  inline-size: var(--ac-global-dimension-size-2400);

  .progress-bar__track {
    forced-color-adjust: none;
    height: var(--ac-global-dimension-size-75);
    border-radius: 3px;
    overflow: hidden;
    background-color: var(
      --mod-barloader-track-color,
      var(--ac-global-color-grey-300)
    );
  }

  .progress-bar__fill {
    background: var(--mod-barloader-fill-color, var(--ac-global-color-primary));
    height: 100%;
  }
`;
