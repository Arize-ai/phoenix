import { useLayoutEffect, type RefObject } from "react";

export function useModalFloatingLayerInteractivity(
  ref: RefObject<HTMLElement | null>,
  isModalLayer: boolean
) {
  useLayoutEffect(() => {
    if (!isModalLayer) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    const enableInteractivity = () => {
      element.inert = false;
      element.removeAttribute("inert");
      element.removeAttribute("aria-hidden");
    };

    enableInteractivity();
    const animationFrameId = window.requestAnimationFrame(enableInteractivity);
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
