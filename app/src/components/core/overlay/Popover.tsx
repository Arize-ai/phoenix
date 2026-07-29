import { css } from "@emotion/react";
import type { CSSProperties, MouseEvent, Ref } from "react";
import { mergeProps } from "react-aria";
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

import { popoverSurfaceCSS } from "./styles";

const popoverCSS = css`
  ${popoverSurfaceCSS}
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

const popoverInteractionBoundaryProps = {
  // React events bubble through the component tree even when a popover is
  // portaled. Keep clicks within the overlay from activating trigger ancestors
  // such as clickable table rows.
  onClick: (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  },
} satisfies Pick<AriaPopoverProps, "onClick">;

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
      {...mergeProps(props, popoverInteractionBoundaryProps)}
      ref={ref}
      style={style}
      className={classNames("popover react-aria-Popover", props.className)}
      css={popoverCSS}
    />
  );
}

export { Popover };
export type { PopoverProps };
