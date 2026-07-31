import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef } from "react";

export const POINTER_OPEN_DWELL_MILLISECONDS = 120;

const COLLAPSED_NAVIGATION_HOVER_TRIGGER_SELECTOR =
  "[data-collapsed-navigation-hover-trigger]";

function getCollapsedNavigationHoverTrigger({
  boundary,
  target,
}: {
  boundary: Element;
  target: EventTarget | null;
}) {
  if (!(target instanceof Element)) {
    return null;
  }
  const trigger = target.closest(COLLAPSED_NAVIGATION_HOVER_TRIGGER_SELECTOR);
  return trigger && boundary.contains(trigger) ? trigger : null;
}

/**
 * Delays pointer-open interactions long enough to distinguish an intentional
 * hover from a quick pass across a compact control. Closing remains immediate.
 *
 * @param params - Pointer-open behavior.
 * @param params.isEnabled - Whether pointer opening is currently available.
 * @param params.onOpenChange - Called after intent is established or on close.
 * @param params.openDelayMilliseconds - Required pointer dwell before opening.
 */
export function useDelayedPointerOpen({
  isEnabled,
  onOpenChange,
  openDelayMilliseconds = POINTER_OPEN_DWELL_MILLISECONDS,
}: {
  isEnabled: boolean;
  onOpenChange: (isOpen: boolean) => void;
  openDelayMilliseconds?: number;
}) {
  const pendingOpenTimeoutIdRef = useRef<number | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!isEnabled) {
      if (pendingOpenTimeoutIdRef.current != null) {
        window.clearTimeout(pendingOpenTimeoutIdRef.current);
        pendingOpenTimeoutIdRef.current = null;
      }
      onOpenChangeRef.current(false);
    }

    return () => {
      if (pendingOpenTimeoutIdRef.current != null) {
        window.clearTimeout(pendingOpenTimeoutIdRef.current);
        pendingOpenTimeoutIdRef.current = null;
      }
    };
  }, [isEnabled]);

  return (isOpen: boolean) => {
    if (pendingOpenTimeoutIdRef.current != null) {
      window.clearTimeout(pendingOpenTimeoutIdRef.current);
      pendingOpenTimeoutIdRef.current = null;
    }

    if (!isOpen) {
      onOpenChangeRef.current(false);
      return;
    }
    if (!isEnabled) {
      return;
    }

    pendingOpenTimeoutIdRef.current = window.setTimeout(() => {
      pendingOpenTimeoutIdRef.current = null;
      onOpenChangeRef.current(true);
    }, openDelayMilliseconds);
  };
}

/**
 * Initiates delayed opening only from rendered compact-navigation rows, then
 * lets the navigation boundary sustain the overlay until the pointer leaves.
 *
 * @param params - Collapsed-navigation hover behavior.
 * @param params.isEnabled - Whether compact-navigation hover is available.
 * @param params.isOpen - Whether pointer hover currently owns the overlay.
 * @param params.onOpenChange - Called when pointer ownership changes.
 */
export function useCollapsedNavigationHoverIntent({
  isEnabled,
  isOpen,
  onOpenChange,
}: {
  isEnabled: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const handlePointerOpenChange = useDelayedPointerOpen({
    isEnabled,
    onOpenChange,
  });

  const handlePointerOver = (event: ReactPointerEvent<HTMLElement>) => {
    if (isOpen) {
      return;
    }
    const enteredTrigger = getCollapsedNavigationHoverTrigger({
      boundary: event.currentTarget,
      target: event.target,
    });
    const previousTrigger = getCollapsedNavigationHoverTrigger({
      boundary: event.currentTarget,
      target: event.relatedTarget,
    });
    if (enteredTrigger && !previousTrigger) {
      handlePointerOpenChange(true);
    }
  };

  const handlePointerOut = (event: ReactPointerEvent<HTMLElement>) => {
    if (isOpen) {
      return;
    }
    const exitedTrigger = getCollapsedNavigationHoverTrigger({
      boundary: event.currentTarget,
      target: event.target,
    });
    const nextTrigger = getCollapsedNavigationHoverTrigger({
      boundary: event.currentTarget,
      target: event.relatedTarget,
    });
    if (exitedTrigger && !nextTrigger) {
      handlePointerOpenChange(false);
    }
  };

  return {
    onPointerLeave: () => handlePointerOpenChange(false),
    onPointerOut: handlePointerOut,
    onPointerOver: handlePointerOver,
  };
}
