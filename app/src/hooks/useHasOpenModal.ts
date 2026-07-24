import { useEffect, useState, useSyncExternalStore } from "react";

import {
  DRAWER_CLASS_NAME,
  MODAL_OVERLAY_CLASS_NAME,
  MODAL_PORTAL_CONTAINER_ATTR,
  MODAL_PORTAL_CONTAINER_SELECTOR,
} from "@phoenix/components/core/overlay/constants";

const DRAWER_SELECTOR = `.${DRAWER_CLASS_NAME}`;
const MODAL_OVERLAY_SELECTOR = `.${MODAL_OVERLAY_CLASS_NAME}`;

let activeModalPortalContainerSnapshot: HTMLElement | null = null;
let activeDrawerSnapshot: HTMLElement | null = null;
let observer: MutationObserver | null = null;
const listeners = new Set<() => void>();

/**
 * Reads the current active modal portal container directly from the DOM.
 *
 * This stays outside React state so multiple hook consumers can share the same
 * source of truth through `useSyncExternalStore`.
 */
function getActiveModalPortalContainerSnapshot() {
  return getActiveModalPortalContainerElement();
}

export function getActiveModalOverlayElement() {
  if (typeof document === "undefined") {
    return null;
  }

  const overlays = document.querySelectorAll<HTMLElement>(
    MODAL_OVERLAY_SELECTOR
  );
  return overlays.item(overlays.length - 1) ?? null;
}

export function getActiveDrawerElement() {
  if (typeof document === "undefined") {
    return null;
  }

  const drawers = document.querySelectorAll<HTMLElement>(DRAWER_SELECTOR);
  return drawers.item(drawers.length - 1) ?? null;
}

export function getActiveModalPortalContainerElement() {
  const overlay = getActiveModalOverlayElement();
  if (!overlay) {
    return null;
  }

  // Phoenix modals declare a portal container. Fall back to the overlay for
  // raw React Aria overlays that do not use the Phoenix Modal wrapper.
  return (
    overlay.querySelector<HTMLElement>(MODAL_PORTAL_CONTAINER_SELECTOR) ??
    overlay
  );
}

/**
 * Recomputes the active modal portal container snapshot and notifies
 * subscribers only when the container identity changes.
 */
function emitIfChanged() {
  const nextModalSnapshot = getActiveModalPortalContainerSnapshot();
  const nextDrawerSnapshot = getActiveDrawerElement();
  if (
    nextModalSnapshot === activeModalPortalContainerSnapshot &&
    nextDrawerSnapshot === activeDrawerSnapshot
  ) {
    return;
  }
  activeModalPortalContainerSnapshot = nextModalSnapshot;
  activeDrawerSnapshot = nextDrawerSnapshot;
  listeners.forEach((listener) => listener());
}

/**
 * Lazily starts the shared DOM observer the first time a component subscribes.
 *
 * The observer watches for react-aria modal overlays being added, removed, or
 * having their identifying class toggled.
 */
function ensureObserver() {
  if (observer || typeof document === "undefined") {
    return;
  }

  activeModalPortalContainerSnapshot = getActiveModalPortalContainerSnapshot();
  activeDrawerSnapshot = getActiveDrawerElement();
  observer = new MutationObserver(emitIfChanged);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", MODAL_PORTAL_CONTAINER_ATTR],
  });
}

/**
 * Tears down the shared observer once the last subscriber unsubscribes.
 */
function cleanupObserver() {
  if (listeners.size > 0 || !observer) {
    return;
  }

  observer.disconnect();
  observer = null;
}

/**
 * Registers a `useSyncExternalStore` subscriber against the active modal portal
 * container and ensures the DOM observer is active while needed.
 */
function subscribe(listener: () => void) {
  ensureObserver();
  listeners.add(listener);
  emitIfChanged();

  return () => {
    listeners.delete(listener);
    cleanupObserver();
  };
}

/**
 * Returns `true` while any react-aria modal overlay is mounted in the document.
 *
 * The implementation uses a single shared `MutationObserver` at module scope so
 * multiple consumers reuse the same DOM subscription instead of each attaching
 * their own observer. The snapshot tracks the active portal container element,
 * not just the boolean open state, so consumers re-render when stacked modals
 * change the active modal. During SSR, the hook always reports `false`.
 */
export function useHasOpenModal() {
  return useActiveModalPortalContainerElement() !== null;
}

/**
 * Returns `true` while any Phoenix non-modal drawer is mounted.
 */
export function useHasOpenDrawer() {
  return useSyncExternalStore(
    subscribe,
    () => getActiveDrawerElement() !== null,
    () => false
  );
}

/**
 * Returns the topmost open Phoenix drawer element, or `null` when none is
 * mounted.
 *
 * Useful for UI that needs to reposition itself relative to a drawer's edge
 * (drawers are fixed to the right viewport edge and cover content beneath
 * them).
 */
export function useActiveDrawerElement() {
  return useSyncExternalStore(subscribe, getActiveDrawerElement, () => null);
}

type DrawerWidthMeasurement = {
  drawer: HTMLElement;
  width: number;
};

/**
 * Returns the active drawer's rendered width, updating as it is resized.
 * Returns zero when no drawer is mounted.
 */
export function useActiveDrawerWidth() {
  const drawer = useActiveDrawerElement();
  const [measurement, setMeasurement] = useState<DrawerWidthMeasurement | null>(
    null
  );

  useEffect(() => {
    if (!drawer) {
      return undefined;
    }

    const measureDrawer = () => {
      setMeasurement({ drawer, width: drawer.offsetWidth });
    };
    const resizeObserver = new ResizeObserver(measureDrawer);
    resizeObserver.observe(drawer);
    measureDrawer();

    return () => resizeObserver.disconnect();
  }, [drawer]);

  return measurement?.drawer === drawer ? measurement.width : 0;
}

/**
 * Returns the portal container for the topmost open modal.
 *
 * Consumers that need to remain interactive while a modal is open should portal
 * into this element so they stay within React Aria's active modal scope.
 */
export function useActiveModalPortalContainerElement() {
  return useSyncExternalStore(
    subscribe,
    getActiveModalPortalContainerSnapshot,
    () => null
  );
}
