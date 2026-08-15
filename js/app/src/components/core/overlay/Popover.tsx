import { css, keyframes } from "@emotion/react";
import { clsx } from "clsx";
import type { CSSProperties, MouseEvent, Ref } from "react";
import { useCallback, useContext } from "react";
import { mergeProps } from "react-aria";
import type {
  PopoverProps as AriaPopoverProps,
  PopoverRenderProps,
} from "react-aria-components";
import {
  Popover as AriaPopover,
  OverlayTriggerStateContext,
  PopoverContext,
  useSlottedContext,
} from "react-aria-components";

import {
  OverlayTreeContext,
  useConsumeOutsidePress,
  useOverlayTreeNode,
} from "./outsideInteraction";
import type { OverlayStackingBand } from "./stacking";
import {
  OVERLAY_STACKING_BAND_Z_INDEX,
  OverlayStackingContext,
  resolveStackingBand,
} from "./stacking";
import { popoverSurfaceCSS } from "./styles";

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
  ${popoverSurfaceCSS}

  transition:
    transform 200ms,
    opacity 200ms;

  &[data-entering],
  &[data-exiting] {
    transform: var(--origin);
    opacity: 0;
  }

  &[data-entering] {
    animation: ${popoverSlideKeyframes} 200ms;
  }

  &[data-exiting] {
    animation: ${popoverSlideKeyframes} 200ms reverse ease-in;
  }

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
  /**
   * Stacking band for the popover surface, named after the global
   * `--global-z-index-app-*` tokens. Stacking is orthogonal to modality
   * (`isNonModal`): pick the band from where the surface belongs in the app's
   * stacking order, never from its interaction contract. A nested popover is
   * clamped to at least its parent's band, so a child overlay cannot paint
   * beneath the overlay that spawned it.
   */
  stacking?: OverlayStackingBand;
  /**
   * Close this non-modal popover when a pointer interaction starts outside
   * it, consuming that interaction so the dismissing press cannot also
   * activate whatever sits beneath. See `useConsumeOutsidePress` for the
   * full contract (trigger toggling, descendant overlays, consumer
   * exemptions). Has no effect on modal popovers, which already own outside
   * interactions.
   */
  closeOnInteractOutside?: boolean;
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
  stacking = "app-portaled-overlay",
  closeOnInteractOutside = false,
  children,
  ...props
}: PopoverProps & { ref?: Ref<HTMLDivElement> }) {
  const inherited = useContext(OverlayStackingContext);
  const band = resolveStackingBand({ requested: stacking, inherited });
  const zIndex = OVERLAY_STACKING_BAND_Z_INDEX[band];

  const { tree, elementRef, registerRef } = useOverlayTreeNode(ref);

  const state = useContext(OverlayTriggerStateContext);
  const popoverContext = useSlottedContext(PopoverContext, props.slot);
  const triggerRef = props.triggerRef ?? popoverContext?.triggerRef;
  const consumerShouldCloseOnInteractOutside =
    props.shouldCloseOnInteractOutside;
  // React Aria's non-modal popovers close when focus moves outside
  // (`shouldCloseOnBlur`), and focus returns to the trigger as part of the
  // very gesture that opens the popover — without a trigger exclusion the
  // popover can dismiss itself before its opening press completes. Default
  // the exclusion here; a consumer-provided policy replaces it wholesale.
  const shouldCloseOnInteractOutside = useCallback(
    (element: Element) => {
      if (consumerShouldCloseOnInteractOutside) {
        return consumerShouldCloseOnInteractOutside(element);
      }
      return !triggerRef?.current?.contains(element);
    },
    [consumerShouldCloseOnInteractOutside, triggerRef]
  );
  // Pointer policy, distinct from the blur policy above: a press on the
  // popover's own trigger IS consumed (and closes), because that is how a
  // modal underlay behaves and it is the only close path for triggers that
  // open on pointerdown (MenuTrigger only ever opens — its toggle-close
  // came from the modal machinery eating the press). The next press reopens
  // through the trigger's own handlers since the popover is closed by then.
  useConsumeOutsidePress({
    elementRef,
    isDisabled:
      !closeOnInteractOutside || props.isNonModal !== true || !state?.isOpen,
    shouldCloseOnInteractOutside: consumerShouldCloseOnInteractOutside,
    state,
    tree,
  });

  const popoverStyle = props.style;
  const style =
    typeof popoverStyle === "function"
      ? (
          renderProps: PopoverRenderProps & { defaultStyle: CSSProperties }
        ) => ({
          ...popoverStyle(renderProps),
          zIndex,
        })
      : { ...popoverStyle, zIndex };
  return (
    <AriaPopover
      {...mergeProps(props, popoverInteractionBoundaryProps)}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
      ref={registerRef}
      style={style}
      className={clsx("popover react-aria-Popover", props.className)}
      css={popoverCSS}
    >
      {(renderProps) => (
        <OverlayTreeContext.Provider value={tree}>
          <OverlayStackingContext.Provider value={band}>
            {typeof children === "function" ? children(renderProps) : children}
          </OverlayStackingContext.Provider>
        </OverlayTreeContext.Provider>
      )}
    </AriaPopover>
  );
}

export { Popover };
export type { PopoverProps };
