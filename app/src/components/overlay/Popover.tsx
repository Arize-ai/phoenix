import { forwardRef, Ref } from "react";
import { Popover as AriaPopover, PopoverProps } from "react-aria-components";
import { css, keyframes } from "@emotion/react";

import { classNames } from "@phoenix/utils";

const popoverSlideKeyframes = keyframes`
 100% {
  from {
     transform: var(--origin);
     opacity: 0;
   }

   to {
     transform: translateY(0);
     opacity: 1;
   }
  }
`;

const popoverCSS = css`
  box-sizing: border-box;
  --background-color: var(--ac-global-popover-background-color);
  transition:
    transform 200ms,
    opacity 200ms;
  border: 1px solid var(--ac-global-popover-border-color);
  box-shadow: var(--px-overlay-box-shadow);
  border-radius: var(--ac-global-rounding-small);
  background: var(--background-color);
  color: var(--ac-global-text-color-900);
  outline: none;

  &[data-entering],
  &[data-exiting] {
    transform: var(--origin);
    opacity: 0;
  }

  .react-aria-OverlayArrow svg {
    display: block;
    fill: var(--background-color);
    stroke: var(--ac-global-border-color-light);
    stroke-width: 1px;
  }

  &[data-trigger="Select"] {
    min-width: var(--trigger-width);
  }

  &[data-placement="top"] {
    --origin: translateY(8px);

    &:has(.react-aria-OverlayArrow) {
      margin-bottom: 6px;
    }
  }

  &[data-placement="bottom"] {
    --origin: translateY(-8px);

    &:has(.react-aria-OverlayArrow) {
      margin-top: 4px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(180deg);
    }
  }

  &[data-placement="right"] {
    --origin: translateX(-8px);

    &:has(.react-aria-OverlayArrow) {
      margin-left: 6px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(90deg);
    }
  }

  &[data-placement="left"] {
    --origin: translateX(8px);

    &:has(.react-aria-OverlayArrow) {
      margin-right: 6px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(-90deg);
    }
  }

  &[data-entering] {
    animation: ${popoverSlideKeyframes} 200ms;
  }

  &[data-exiting] {
    animation: ${popoverSlideKeyframes} 200ms reverse ease-in;
  }

  .react-aria-Dialog {
    outline: none;
  }

  & div[role="listbox"] {
    padding: var(--ac-global-dimension-size-25);
  }
`;

function Popover(props: PopoverProps, ref: Ref<HTMLDivElement>) {
  return (
    <AriaPopover
      {...props}
      ref={ref}
      className={classNames("ac-popover react-aria-Popover", props.className)}
      css={popoverCSS}
    />
  );
}
popoverCSS;

const _Popover = forwardRef(Popover);
export { _Popover as Popover };
export type { PopoverProps };
