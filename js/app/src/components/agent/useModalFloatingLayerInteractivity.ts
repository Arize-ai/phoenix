import { useLayoutEffect, type RefObject } from "react";

/**
 * Keeps an assistant-owned floating surface interactive while it is rendered in
 * the active modal layer.
 *
 * React Aria protects modal focus by marking content outside the active modal
 * scope as `inert` and/or `aria-hidden`. The assistant FAB and floating panel
 * are portaled into the modal portal container, but React Aria may still apply
 * those attributes during the same commit as the portal move. This hook
 * removes the attributes from the assistant surface itself so pointer, keyboard,
 * and assistive-technology access continue to work above the modal mask.
 *
 * Only use this for surfaces that are intentionally part of the active modal
 * interaction layer. Normal page-level floating UI should remain inert while a
 * modal is open.
 */
export function useModalFloatingLayerInteractivity(
  ref: RefObject<HTMLElement | null>,
  isModalLayer: boolean
) {
  useLayoutEffect(() => {
    if (!isModalLayer) {
      return undefined;
    }

    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const enableInteractivity = () => {
      element.inert = false;
      element.removeAttribute("inert");
      element.removeAttribute("aria-hidden");
    };

    enableInteractivity();
    // React Aria can apply modal isolation attributes after our layout effect
    // runs, so retry once on the next frame after the overlay settles.
    const animationFrameId = window.requestAnimationFrame(enableInteractivity);
    // Keep the surface interactive if React Aria re-applies isolation
    // attributes while stacked modals mount, unmount, or change active scope.
    const observer = new MutationObserver(enableInteractivity);
    observer.observe(element, {
      attributeFilter: ["aria-hidden", "inert"],
      attributes: true,
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [isModalLayer, ref]);
}
