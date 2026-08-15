/**
 * Tier 1 — the viewport modal. Blocks only the application viewport; the
 * assistant rail stays an ordinary, interactive sibling. Never `aria-modal`
 * (that would hide the still-interactive rail from assistive technology).
 *
 * ── Polyfill ledger ─────────────────────────────────────────────────────
 * React Aria's modality is hardwired to the window: `useModalOverlay` hides
 * everything outside the overlay from `document.body` down, and neither the
 * hooks nor RAC expose the `root`/exemption options that exist on the raw
 * `ariaHideOutside` utility. Region-scoped modality is a known, open gap:
 *   - adobe/react-spectrum#8784 (option to skip hiding) — closed unfixed
 *   - adobe/react-spectrum#8796 (stacking-context-aware inert) — unmerged
 *   - adobe/react-spectrum#7743 (scoped scroll lock), #7954 (optional focus
 *     trap) — open
 * Until those land, this component owns blocking itself: it portals into the
 * frame's viewport-modal plane, registers with the frame (which stamps
 * `inert` on the blocked regions), and scopes focus with `FocusScope`.
 * If react-aria ships region modality, this collapses onto RAC's `Modal`.
 *
 * Load-bearing: the `useOverlay` call below is what enrolls this overlay in
 * React Aria's internal overlay stack — it is why Escape and outside presses
 * resolve top-down correctly against menus and popovers opened above the
 * modal. Do not replace it with a bare keydown listener.
 * ────────────────────────────────────────────────────────────────────────
 */
import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { FocusScope, mergeRefs, Overlay, useOverlay } from "react-aria";
import type {
  ModalOverlayProps as AriaModalOverlayProps,
  OverlayTriggerState,
} from "react-aria-components";
import { OverlayTriggerStateContext } from "react-aria-components";
import { flushSync } from "react-dom";

import { DrawerContext } from "./DrawerContext";
import {
  useOverlayFrame,
  VIEWPORT_MODAL_INTERACTION_EXEMPT_SELECTOR,
} from "./frame";
import type { ModalSize } from "./Modal";
import { centeredModalCSS, modalBackdropCSS } from "./Modal";
import {
  useResolvedOverlayTriggerState,
  withInterceptedClose,
} from "./triggerState";

type ViewportModalContextValue = {
  isDismissable: boolean;
  isKeyboardDismissDisabled: boolean;
  shouldCloseOnInteractOutside: (target: Element) => boolean;
  state: OverlayTriggerState;
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

/**
 * A dialog overlay that blocks only the application viewport. The pinned
 * assistant rail remains an ordinary, interactive sibling.
 */
export function ViewportModalOverlay({
  children,
  defaultOpen,
  // Matches this module's ModalOverlay wrapper (not React Aria's default): a
  // backdrop press dismisses unless a caller opts out. Presses outside the
  // application viewport (e.g. on the assistant rail) never dismiss — see
  // canCloseForTarget.
  isDismissable = true,
  isKeyboardDismissDisabled = false,
  isOpen,
  onOpenChange,
  ref,
  shouldCloseOnInteractOutside,
  ...domProps
}: ViewportModalOverlayProps) {
  const state = useResolvedOverlayTriggerState({
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
  state: OverlayTriggerState;
  style?: AriaModalOverlayProps["style"];
}) {
  const frame = useOverlayFrame();
  const registerViewportOverlay = frame?.registerViewportOverlay;
  const unregisterViewportOverlay = frame?.unregisterViewportOverlay;
  const registrationRef = useRef(false);
  const restoreTargetRef = useRef<HTMLElement | null>(null);
  const portalContainer =
    frame == null ? document.body : frame.viewportModalHostElement;

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
      // FocusScope's own restoreFocus loses the race when the restore target
      // sat inside a region the frame had stamped inert — focus lands on the
      // body instead. Restore by hand once the frame has released `inert`.
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
    // Release the frame's blocked state synchronously so the regions it
    // stamped `inert` are interactive again before focus restoration runs.
    if (registrationRef.current && unregisterViewportOverlay) {
      flushSync(unregisterViewportOverlay);
      registrationRef.current = false;
    }
    state.close();
  };

  const scopedState = withInterceptedClose(state, close);

  const canCloseForTarget = (target: Element) => {
    if (target.closest(VIEWPORT_MODAL_INTERACTION_EXEMPT_SELECTOR)) {
      return false;
    }
    const applicationViewport = frame?.applicationViewportElement;
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
          {/* The overlay portals out of any drawer subtree, so descendants
              are not "in a drawer" regardless of where the trigger lives.
              Without this reset, a modal launched from a drawer renders the
              drawer's collapse-chevron close icon instead of the standard ×. */}
          <DrawerContext.Provider value={false}>
            <FocusScope autoFocus restoreFocus>
              {children}
            </FocusScope>
          </DrawerContext.Provider>
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
  // Enrolls the modal in React Aria's overlay stack (see the file banner).
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
