import { useSyncExternalStore } from "react";

const MODAL_SELECTOR = ".react-aria-ModalOverlay";

let openModalFloatingLayerSnapshot: HTMLElement | null = null;
let observer: MutationObserver | null = null;
const listeners = new Set<() => void>();

/**
 * Reads the current active modal floating layer directly from the DOM.
 *
 * This stays outside React state so multiple hook consumers can share the same
 * source of truth through `useSyncExternalStore`.
 */
function getOpenModalFloatingLayerSnapshot() {
  return getOpenModalFloatingLayerElement();
}

export function getOpenModalOverlayElement() {
  if (typeof document === "undefined") {
    return null;
  }

  const overlays = document.querySelectorAll<HTMLElement>(MODAL_SELECTOR);
  return overlays.item(overlays.length - 1) ?? null;
}

export function getOpenModalFloatingLayerElement() {
  const overlay = getOpenModalOverlayElement();
  if (!overlay) {
    return null;
  }

  for (const child of overlay.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    if (
      child.classList.contains("agent-chat-widget-positioner") ||
      child.classList.contains("resizable-floating-panel")
    ) {
      continue;
    }
    return child;
  }

  return overlay;
}

/**
 * Recomputes the active modal floating layer snapshot and notifies subscribers
 * only when the layer identity changes.
 */
function emitIfChanged() {
  const nextSnapshot = getOpenModalFloatingLayerSnapshot();
  if (nextSnapshot === openModalFloatingLayerSnapshot) {
    return;
  }
  openModalFloatingLayerSnapshot = nextSnapshot;
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

  openModalFloatingLayerSnapshot = getOpenModalFloatingLayerSnapshot();
  observer = new MutationObserver(emitIfChanged);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
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
 * Registers a `useSyncExternalStore` subscriber against the shared active modal
 * floating layer snapshot and ensures the DOM observer is active while needed.
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
 * their own observer. The snapshot tracks the active floating layer element,
 * not just the boolean open state, so consumers re-render when stacked modals
 * change the top layer. During SSR, the hook always reports `false`.
 */
export function useHasOpenModal() {
  return useOpenModalFloatingLayerElement() !== null;
}

export function useOpenModalFloatingLayerElement() {
  return useSyncExternalStore(
    subscribe,
    getOpenModalFloatingLayerSnapshot,
    () => null
  );
}
