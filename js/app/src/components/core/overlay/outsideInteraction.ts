/**
 * Outside-press consumption for NON-MODAL overlays — a polyfill for a gap in
 * React Aria.
 *
 * React Aria already consumes the outside press that dismisses an overlay
 * (capture-phase `stopPropagation` for the topmost overlay in its internal
 * stack) — but only for overlays it considers dismissable, and `usePopover`
 * hardcodes `isDismissable: !isNonModal`. A non-modal RAC popover therefore
 * neither dismisses on outside press nor protects what sits beneath from
 * the dismissing press. Phoenix needs "non-modal, but the dismissing press
 * is consumed" for menus and consult-while-working popovers (see README.md,
 * "Non-modal surfaces").
 *
 * ── Polyfill ledger ─────────────────────────────────────────────────────
 * Remove this file when react-aria lets a non-modal popover opt into
 * dismissable-with-consumption. Related upstream work:
 *   - useOverlay's stack has no public enrollment API (maintainer position
 *     in adobe/react-spectrum#8784) — which is why the overlay tree below
 *     must exist in parallel.
 *   - adobe/react-spectrum#9818 (unmerged): native CloseWatcher dismissal.
 * Known divergence from React Aria, kept deliberately: RA never calls
 * `preventDefault()` on the outside press (it preserves focus-on-mousedown
 * and text selection); this polyfill does, because the consumed press must
 * not move focus into the surface it was prevented from activating.
 * ────────────────────────────────────────────────────────────────────────
 */
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useInteractOutside } from "react-aria";
import type { OverlayTriggerState } from "react-aria-components";

/**
 * Registry linking an overlay to the overlay elements rendered from its
 * React subtree. DOM containment cannot express this relationship because
 * nested overlays portal to the body; React context can, since it follows
 * the component tree. Registration propagates upward so an ancestor's
 * `contains` covers every descendant overlay, however deep.
 */
export type OverlayTreeNode = {
  register: (element: Element) => () => void;
  contains: (target: Node) => boolean;
};

export function createOverlayTreeNode(
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

export const OverlayTreeContext = createContext<OverlayTreeNode | null>(null);

/**
 * Create this overlay's node in the overlay tree and a ref callback that
 * registers the overlay's DOM element with it (and with every ancestor).
 * The overlay element only exists while open, so registration is keyed to
 * ref attachment rather than an effect: the node arrives when the overlay
 * opens and leaves when it closes.
 */
export function useOverlayTreeNode(ref?: React.Ref<HTMLDivElement>) {
  const parentTree = useContext(OverlayTreeContext);
  const tree = useMemo(() => createOverlayTreeNode(parentTree), [parentTree]);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);
  const registerRef = useCallback(
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
  return { tree, elementRef, registerRef };
}

/**
 * Close a non-modal overlay when a pointer interaction starts outside it,
 * consuming that interaction so the dismissing press cannot also activate
 * whatever sits beneath — the same guarantee a modal underlay provides,
 * without the scroll lock or the `ariaHideOutside` walk.
 *
 * A press on the overlay's own trigger is also consumed and closes
 * (modal-parity toggle; the next press reopens). Interactions inside
 * descendant overlays (recognized across portals via the overlay tree) are
 * left alone so they keep working, and a consumer-provided
 * `shouldCloseOnInteractOutside` exempts targets from both closing and
 * consumption (use it for coordinated sibling-trigger groups).
 */
export function useConsumeOutsidePress({
  elementRef,
  isDisabled,
  shouldCloseOnInteractOutside,
  state,
  tree,
}: {
  elementRef: React.RefObject<HTMLDivElement | null>;
  isDisabled: boolean;
  /** Consumer policy: returning false exempts the target entirely. */
  shouldCloseOnInteractOutside?: (element: Element) => boolean;
  state: OverlayTriggerState | null;
  tree: OverlayTreeNode;
}) {
  const shouldIgnoreOutsideInteraction = useCallback(
    (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        return false;
      }
      if (tree.contains(event.target)) {
        return true;
      }
      if (
        shouldCloseOnInteractOutside &&
        !shouldCloseOnInteractOutside(event.target)
      ) {
        return true;
      }
      return false;
    },
    [tree, shouldCloseOnInteractOutside]
  );

  useInteractOutside({
    ref: elementRef,
    isDisabled,
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
}
