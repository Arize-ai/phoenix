import type { Bounds } from "@phoenix/types/geometry";

export function getViewportBounds(): Bounds {
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return {
      left: visualViewport.offsetLeft,
      top: visualViewport.offsetTop,
      width: visualViewport.width,
      height: visualViewport.height,
    };
  }

  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function getBoundaryBounds(
  boundary: HTMLElement | null | undefined
): Bounds | null {
  if (!boundary) return null;
  const rect = boundary.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function getPositioningBounds({
  boundary,
  requiresBoundary,
}: {
  boundary: HTMLElement | null | undefined;
  requiresBoundary: boolean;
}): Bounds | null {
  return (
    getBoundaryBounds(boundary) ??
    (requiresBoundary ? null : getViewportBounds())
  );
}