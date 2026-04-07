import { useSyncExternalStore } from "react";

const MODAL_SELECTOR = ".react-aria-ModalOverlay";

let hasOpenModalSnapshot = false;
let observer: MutationObserver | null = null;
const listeners = new Set<() => void>();

/**
 * Reads the current modal-open state directly from the DOM.
 *
 * This stays outside React state so multiple hook consumers can share the same
 * source of truth through `useSyncExternalStore`.
 */
function getHasOpenModalSnapshot() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.querySelector(MODAL_SELECTOR) !== null;
}

/**
 * Recomputes the modal-open snapshot and notifies subscribers only when the
 * boolean value actually changes.
 */
function emitIfChanged() {
  const nextSnapshot = getHasOpenModalSnapshot();
  if (nextSnapshot === hasOpenModalSnapshot) {
    return;
  }
  hasOpenModalSnapshot = nextSnapshot;
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

  hasOpenModalSnapshot = getHasOpenModalSnapshot();
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
 * Registers a `useSyncExternalStore` subscriber against the shared modal-open
 * snapshot and ensures the DOM observer is active while needed.
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
 * their own observer. During SSR, the hook always reports `false`.
 */
export function useHasOpenModal() {
  return useSyncExternalStore(subscribe, getHasOpenModalSnapshot, () => false);
}
