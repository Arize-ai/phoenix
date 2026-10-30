import { useEvent, useResizeObserver } from "@react-aria/utils";
import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether a horizontally scrollable list (a tab bar, a section nav)
 * has items hidden beyond its start and/or end edges. Used to render a
 * directional fade affordance on the bar, since the scrollbar is hidden and
 * macOS does not show one until the user actively scrolls.
 *
 * Returns a ref to attach to the scroll container plus booleans for whether
 * content overflows past the start (left) and end (right) edges.
 */
export function useHorizontalOverflow<
  T extends HTMLElement = HTMLDivElement,
>() {
  const elementRef = useRef<T | null>(null);
  const [hasOverflowAtStart, setHasOverflowAtStart] = useState(false);
  const [hasOverflowAtEnd, setHasOverflowAtEnd] = useState(false);

  const update = () => {
    const el = elementRef.current;
    if (!el) {
      return;
    }
    // The fade affordance only applies to horizontal lists; clear any
    // overflow state left over from before an orientation flip so vertical
    // lists never report horizontal overflow.
    if (el.getAttribute("data-orientation") !== "horizontal") {
      setHasOverflowAtStart(false);
      setHasOverflowAtEnd(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Account for sub-pixel rounding so the fade doesn't linger at the ends.
    const maxScroll = scrollWidth - clientWidth;
    setHasOverflowAtStart(scrollLeft > 1);
    setHasOverflowAtEnd(scrollLeft < maxScroll - 1);
  };

  useEvent(elementRef, "scroll", update);
  useResizeObserver({ ref: elementRef, onResize: update });
  // The resize observer only sees the container's own box, so content-width
  // changes that don't resize it (items added or removed, count badges
  // updating) would go unnoticed. Those changes all flow through a React
  // render, so re-measure after every commit.
  useEffect(() => {
    update();
  });

  return { ref: elementRef, hasOverflowAtStart, hasOverflowAtEnd };
}
