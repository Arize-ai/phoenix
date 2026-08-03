import { css, keyframes } from "@emotion/react";
import type { CSSProperties, MouseEvent, Ref } from "react";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { mergeProps, useInteractOutside } from "react-aria";
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

import type { OverlayStackingBand } from "@phoenix/components/core/zIndex";
import {
  OVERLAY_STACKING_BAND_Z_INDEX,
  OVERLAY_STACKING_BANDS,
} from "@phoenix/components/core/zIndex";
import { classNames } from "@phoenix/utils/classNames";

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
   * Close this non-modal popover when a pointer interaction starts outside it,
   * consuming that interaction so the dismissing press cannot also activate
   * whatever sits beneath — the same guarantee a modal underlay provides,
   * without the scroll lock or the `ariaHideOutside` walk. A press on the
   * popover's own trigger is also consumed and closes (modal-parity toggle;
   * the next press reopens). Interactions inside descendant popovers (menus,
   * submenus, nested pickers — recognized across portals) are left alone so
   * they keep working, and a consumer-provided `shouldCloseOnInteractOutside`
   * exempts targets from both closing and consumption (use it for coordinated
   * sibling-trigger groups). Has no effect on modal popovers, which already
   * own outside interactions.
   */
  closeOnInteractOutside?: boolean;
};

const OverlayStackingContext = createContext<OverlayStackingBand | null>(null);

/**
 * Registry linking a popover to the popover elements rendered from its React
 * subtree. DOM containment cannot express this relationship because nested
 * popovers portal to the body; React context can, since it follows the
 * component tree. Registration propagates upward so an ancestor's `contains`
 * covers every descendant overlay, however deep.
 */
type OverlayTreeNode = {
  register: (element: Element) => () => void;
  contains: (target: Node) => boolean;
};

function createOverlayTreeNode(
  parent: OverlayTreeNode | null
): OverlayTreeNode {
  const elements = new Set<Element>();
  return {
    register: (element) => {
      elements.add(element);
      const unregisterFromParent = parent?.register(element);
      return () => {
        elements.delete(element);
        unregisterFromParent?.();
      };
    },
    contains: (target) => {
      for (const element of elements) {
        if (element.contains(target)) {
          return true;
        }
      }
      return false;
    },
  };
}

const OverlayTreeContext = createContext<OverlayTreeNode | null>(null);

function resolveStackingBand({
  requested,
  inherited,
}: {
  requested: OverlayStackingBand;
  inherited: OverlayStackingBand | null;
}): OverlayStackingBand {
  if (
    inherited !== null &&
    OVERLAY_STACKING_BANDS.indexOf(inherited) >
      OVERLAY_STACKING_BANDS.indexOf(requested)
  ) {
    return inherited;
  }
  return requested;
}

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

  const parentTree = useContext(OverlayTreeContext);
  const tree = useMemo(() => createOverlayTreeNode(parentTree), [parentTree]);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);
  // The popover element only exists while open, so registration is keyed to
  // ref attachment rather than an effect: the node arrives when the popover
  // opens and leaves when it closes.
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      unregisterRef.current?.();
      unregisterRef.current = node ? tree.register(node) : null;
      elementRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref, tree]
  );

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
  const shouldIgnoreOutsideInteraction = useCallback(
    (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        return false;
      }
      if (tree.contains(event.target)) {
        return true;
      }
      // A consumer-provided policy (e.g. sibling-trigger exclusions) also
      // exempts the press from consumption, not just from closing.
      if (
        consumerShouldCloseOnInteractOutside &&
        !consumerShouldCloseOnInteractOutside(event.target)
      ) {
        return true;
      }
      return false;
    },
    [tree, consumerShouldCloseOnInteractOutside]
  );
  useInteractOutside({
    ref: elementRef,
    isDisabled:
      !closeOnInteractOutside || props.isNonModal !== true || !state?.isOpen,
    onInteractOutsideStart: (event) => {
      if (shouldIgnoreOutsideInteraction(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    onInteractOutside: (event) => {
      if (shouldIgnoreOutsideInteraction(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      state?.close();
    },
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
      ref={mergedRef}
      style={style}
      className={classNames("popover react-aria-Popover", props.className)}
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
