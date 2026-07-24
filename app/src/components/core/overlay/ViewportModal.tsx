import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FocusScope, mergeRefs, Overlay, useOverlay } from "react-aria";
import type { ModalOverlayProps as AriaModalOverlayProps } from "react-aria-components";
import { OverlayTriggerStateContext } from "react-aria-components";
import { flushSync } from "react-dom";

import { useAppFrameOverlay } from "./AppFrameOverlayContext";
import type { ModalSize } from "./Modal";
import { centeredModalCSS, modalBackdropCSS } from "./Modal";

type ViewportOverlayState = {
  close: () => void;
  isOpen: boolean;
  open: () => void;
  setOpen: (isOpen: boolean) => void;
  toggle: () => void;
};

type ViewportModalContextValue = {
  isDismissable: boolean;
  isKeyboardDismissDisabled: boolean;
  shouldCloseOnInteractOutside: (target: Element) => boolean;
  state: ViewportOverlayState;
};

const ViewportModalContext = createContext<ViewportModalContextValue | null>(
  null
);

const viewportModalOverlayCSS = css`
  ${modalBackdropCSS};
  position: absolute;
  pointer-events: auto;
`;

const viewportModalCSS = css`
  ${centeredModalCSS};
  position: absolute;
  inset: 0;
  pointer-events: none;

  &[data-size="fullscreen"] {
    --modal-width: calc(100% - var(--global-dimension-size-800));
  }

  .react-aria-Dialog {
    pointer-events: auto;
  }
`;

export type ViewportModalOverlayProps = Omit<
  AriaModalOverlayProps,
  "children"
> & {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

function useViewportOverlayState({
  defaultOpen,
  isOpen,
  onOpenChange,
}: Pick<
  ViewportModalOverlayProps,
  "defaultOpen" | "isOpen" | "onOpenChange"
>): ViewportOverlayState {
  const triggerState = useContext(OverlayTriggerStateContext);
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false);
  const shouldUseTriggerState =
    isOpen == null && defaultOpen == null && triggerState != null;
  const resolvedIsOpen = shouldUseTriggerState
    ? triggerState.isOpen
    : (isOpen ?? localOpen);

  const setOpen = (nextIsOpen: boolean) => {
    if (shouldUseTriggerState) {
      triggerState.setOpen(nextIsOpen);
      return;
    }
    if (isOpen == null) setLocalOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  };

  return {
    close: () => setOpen(false),
    isOpen: resolvedIsOpen,
    open: () => setOpen(true),
    setOpen,
    toggle: () => setOpen(!resolvedIsOpen),
  };
}

/**
 * A dialog overlay that blocks only the application viewport. The pinned
 * assistant rail remains an ordinary, interactive sibling.
 */
export function ViewportModalOverlay({
  children,
  defaultOpen,
  isDismissable = false,
  isKeyboardDismissDisabled = false,
  isOpen,
  onOpenChange,
  ref,
  shouldCloseOnInteractOutside,
  ...domProps
}: ViewportModalOverlayProps) {
  const state = useViewportOverlayState({
    defaultOpen,
    isOpen,
    onOpenChange,
  });

  if (!state.isOpen) return null;

  return (
    <ViewportModalOverlayInner
      {...domProps}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      ref={ref}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
      state={state}
    >
      {children}
    </ViewportModalOverlayInner>
  );
}

function ViewportModalOverlayInner({
  children,
  className,
  isDismissable,
  isKeyboardDismissDisabled,
  ref,
  shouldCloseOnInteractOutside,
  state,
  style,
}: {
  children: ReactNode;
  className?: AriaModalOverlayProps["className"];
  isDismissable: boolean;
  isKeyboardDismissDisabled: boolean;
  ref?: Ref<HTMLDivElement>;
  shouldCloseOnInteractOutside?: (target: Element) => boolean;
  state: ViewportOverlayState;
  style?: AriaModalOverlayProps["style"];
}) {
  const appFrameOverlay = useAppFrameOverlay();
  const registerViewportOverlay = appFrameOverlay?.registerViewportOverlay;
  const unregisterViewportOverlay = appFrameOverlay?.unregisterViewportOverlay;
  const registrationRef = useRef(false);
  const restoreTargetRef = useRef<HTMLElement | null>(null);
  const portalContainer =
    appFrameOverlay == null
      ? document.body
      : appFrameOverlay.viewportModalHostElement;

  useLayoutEffect(() => {
    restoreTargetRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    registerViewportOverlay?.();
    registrationRef.current = true;

    return () => {
      if (registrationRef.current) {
        unregisterViewportOverlay?.();
        registrationRef.current = false;
      }
      const restoreTarget = restoreTargetRef.current;
      window.requestAnimationFrame(() => {
        if (
          restoreTarget?.isConnected &&
          restoreTarget.closest("[inert]") == null &&
          document.activeElement === document.body
        ) {
          restoreTarget.focus();
        }
      });
    };
  }, [registerViewportOverlay, unregisterViewportOverlay]);

  const close = () => {
    if (registrationRef.current && unregisterViewportOverlay) {
      flushSync(unregisterViewportOverlay);
      registrationRef.current = false;
    }
    state.close();
  };

  const scopedState: ViewportOverlayState = {
    ...state,
    close,
    setOpen: (nextIsOpen) => {
      if (!nextIsOpen) {
        close();
        return;
      }
      state.setOpen(true);
    },
    toggle: () => {
      if (state.isOpen) close();
      else state.open();
    },
  };

  const canCloseForTarget = (target: Element) => {
    const applicationViewport = appFrameOverlay?.applicationViewportElement;
    if (applicationViewport && !applicationViewport.contains(target)) {
      return false;
    }
    return shouldCloseOnInteractOutside?.(target) ?? true;
  };

  const overlay = (
    <div
      data-testid="viewport-modal-overlay"
      className={typeof className === "string" ? className : undefined}
      css={viewportModalOverlayCSS}
      ref={ref}
      style={typeof style === "object" ? style : undefined}
    >
      <OverlayTriggerStateContext.Provider value={scopedState}>
        <ViewportModalContext.Provider
          value={{
            isDismissable,
            isKeyboardDismissDisabled,
            shouldCloseOnInteractOutside: canCloseForTarget,
            state: scopedState,
          }}
        >
          <FocusScope autoFocus restoreFocus>
            {children}
          </FocusScope>
        </ViewportModalContext.Provider>
      </OverlayTriggerStateContext.Provider>
    </div>
  );

  // A provider-owned overlay must never escape to document.body while the
  // frame's portal plane is being attached. The host ref is populated during
  // the same commit, so this avoids a transient full-window modal without
  // delaying the visible open state by a paint.
  if (!portalContainer) return null;

  return (
    <Overlay disableFocusManagement portalContainer={portalContainer}>
      {overlay}
    </Overlay>
  );
}

export type ViewportModalProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  size?: ModalSize;
};

export function ViewportModal({
  children,
  ref,
  size = "M",
  ...domProps
}: ViewportModalProps) {
  const context = useContext(ViewportModalContext);
  const localRef = useRef<HTMLDivElement>(null);
  const resolvedRef = mergeRefs(localRef, ref);
  const { overlayProps } = useOverlay(
    {
      isDismissable: context?.isDismissable,
      isKeyboardDismissDisabled: context?.isKeyboardDismissDisabled,
      isOpen: context?.state.isOpen ?? true,
      onClose: context?.state.close,
      shouldCloseOnInteractOutside: context?.shouldCloseOnInteractOutside,
    },
    localRef
  );

  return (
    <div
      {...domProps}
      {...overlayProps}
      className="react-aria-Modal"
      css={viewportModalCSS}
      data-size={size}
      ref={resolvedRef}
    >
      {children}
    </div>
  );
}
