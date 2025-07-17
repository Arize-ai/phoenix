import { css } from "@emotion/react";

export const tooltipCSS = css`
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  border-radius: var(--ac-global-rounding-small);
  background: var(--ac-global-tooltip-background-color);
  border: var(--ac-global-border-size-thin) solid
    var(--ac-global-tooltip-border-color);
  color: var(--ac-global-text-color-900);
  forced-color-adjust: none;
  outline: none;
  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-200);
  max-width: 150px;
  font-size: var(--ac-global-font-size-s);
  /* fixes FF gap */
  transform: translate3d(0, 0, 0);
  transition:
    transform 200ms,
    opacity 200ms;

  &[data-entering],
  &[data-exiting] {
    transform: var(--tooltip-origin);
    opacity: 0;
  }

  &[data-placement="top"] {
    margin-bottom: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateY(4px);
  }

  &[data-placement="bottom"] {
    margin-top: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateY(-4px);

    & .react-aria-OverlayArrow svg {
      transform: rotate(180deg);
    }
  }

  &[data-placement="right"] {
    margin-left: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateX(-4px);

    & .react-aria-OverlayArrow svg {
      transform: rotate(90deg);
    }
  }

  &[data-placement="left"] {
    margin-right: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateX(4px);

    & .react-aria-OverlayArrow svg {
      transform: rotate(-90deg);
    }
  }

  & .react-aria-OverlayArrow svg {
    display: block;
    fill: var(--ac-global-tooltip-background-color);
    stroke: var(--ac-global-tooltip-border-color);
    stroke-width: 1px;
  }
`;

export const richTooltipCSS = css`
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  border-radius: var(--ac-global-rounding-medium);
  background: var(--ac-global-tooltip-background-color);
  border: var(--ac-global-border-size-thin) solid
    var(--ac-global-tooltip-border-color);
  color: var(--ac-global-text-color-900);
  forced-color-adjust: none;
  outline: none;
  padding: var(--ac-global-dimension-static-size-200);
  min-width: 200px;
  font-size: var(--ac-global-font-size-s);
  /* fixes FF gap */
  transform: translate3d(0, 0, 0);
  transition:
    transform 200ms,
    opacity 200ms;

  &[data-entering],
  &[data-exiting] {
    transform: var(--tooltip-origin);
    opacity: 0;
  }

  &[data-placement="top"] {
    margin-bottom: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateY(4px);
  }

  &[data-placement="bottom"] {
    margin-top: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateY(-4px);

    & .react-aria-OverlayArrow svg {
      transform: rotate(180deg);
    }
  }

  &[data-placement="right"] {
    margin-left: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateX(-4px);

    & .react-aria-OverlayArrow svg {
      transform: rotate(90deg);
    }
  }

  &[data-placement="left"] {
    margin-right: var(--ac-global-dimension-static-size-100);
    --tooltip-origin: translateX(4px);

    & .react-aria-OverlayArrow svg {
      transform: rotate(-90deg);
    }
  }

  & .react-aria-OverlayArrow svg {
    display: block;
    fill: var(--ac-global-tooltip-background-color);
    stroke: var(--ac-global-tooltip-border-color);
    stroke-width: 1px;
  }
`;
