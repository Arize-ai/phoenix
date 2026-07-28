import { css } from "@emotion/react";
import type { CSSProperties, Ref } from "react";
import type {
  PopoverProps as AriaPopoverProps,
  PopoverRenderProps,
} from "react-aria-components";
import { Popover as AriaPopover } from "react-aria-components";

import {
  NON_MODAL_FLOATING_Z_INDEX,
  PORTALED_OVERLAY_Z_INDEX,
} from "@phoenix/components/core/zIndex";
import { classNames } from "@phoenix/utils/classNames";

const popoverCSS = css`
  box-sizing: border-box;
  --background-color: var(--global-popover-background-color);
  border: 1px solid var(--global-popover-border-color);
  box-shadow: 0px 8px 16px var(--global-overlay-shadow-color);
  border-radius: var(--global-rounding-small);
  background: var(--background-color);
  color: var(--global-text-color-900);
  outline: none;
  z-index: ${PORTALED_OVERLAY_Z_INDEX};

  .react-aria-OverlayArrow svg {
    display: block;
    fill: var(--background-color);
    stroke: var(--global-border-color-default);
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

  .react-aria-Dialog {
    outline: none;
  }

  & div[role="listbox"] {
    padding: var(--global-dimension-size-25);
  }
`;

type PopoverProps = AriaPopoverProps & {
  layer?: "non-modal" | "portaled";
};

function Popover({
  ref,
  layer = "portaled",
  ...props
}: PopoverProps & { ref?: Ref<HTMLDivElement> }) {
  const popoverStyle = props.style;
  const style =
    layer === "non-modal"
      ? typeof popoverStyle === "function"
        ? (
            renderProps: PopoverRenderProps & { defaultStyle: CSSProperties }
          ) => ({
            ...popoverStyle(renderProps),
            zIndex: NON_MODAL_FLOATING_Z_INDEX,
          })
        : { ...popoverStyle, zIndex: NON_MODAL_FLOATING_Z_INDEX }
      : popoverStyle;
  return (
    <AriaPopover
      {...props}
      ref={ref}
      style={style}
      className={classNames("popover react-aria-Popover", props.className)}
      css={popoverCSS}
    />
  );
}

export { Popover };
export type { PopoverProps };
