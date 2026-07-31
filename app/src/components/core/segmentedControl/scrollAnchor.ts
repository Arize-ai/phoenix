/**
 * A segmented control is often linked to every output card in a stack — one
 * markdown/text or table/JSON switch re-renders all of them, and a small
 * per-card reflow compounds into a large shift that carries the clicked
 * control (and the user's pointer) away from where it was. Anchoring the
 * scroll position to the control itself keeps the thing the user just clicked
 * exactly where they clicked it.
 */
export type SegmentedControlScrollAnchor = {
  element: HTMLElement;
  scrollContainer: HTMLElement;
  offsetFromScrollContainerTop: number;
};

/** Finds the nearest ancestor whose vertical overflow is owned by scrolling. */
function getScrollContainer(element: HTMLElement): HTMLElement | null {
  let currentElement = element.parentElement;
  while (currentElement) {
    const { overflowY } = getComputedStyle(currentElement);
    if (overflowY === "auto" || overflowY === "scroll") {
      return currentElement;
    }
    currentElement = currentElement.parentElement;
  }
  return null;
}

/**
 * Records the control's position in its nearest scroll container. The control
 * stays in its card or section header, so it is also a stable anchor for the
 * owning surface without coupling this component to any consumer's DOM shape.
 */
export function captureSegmentedControlScrollAnchor(
  control: HTMLElement | null
): SegmentedControlScrollAnchor | null {
  if (!control) {
    return null;
  }
  const scrollContainer = getScrollContainer(control);
  if (!scrollContainer) {
    return null;
  }
  return {
    element: control,
    scrollContainer,
    offsetFromScrollContainerTop:
      control.getBoundingClientRect().top -
      scrollContainer.getBoundingClientRect().top,
  };
}

/** Restores a captured control after the linked content has reflowed. */
export function restoreSegmentedControlScrollAnchor(
  anchor: SegmentedControlScrollAnchor
): void {
  const { element, scrollContainer, offsetFromScrollContainerTop } = anchor;
  if (!element.isConnected || !scrollContainer.contains(element)) {
    return;
  }
  const newOffsetFromScrollContainerTop =
    element.getBoundingClientRect().top -
    scrollContainer.getBoundingClientRect().top;
  scrollContainer.scrollTop +=
    newOffsetFromScrollContainerTop - offsetFromScrollContainerTop;
}
