import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import type { SegmentedControlSelectionRegistry } from "./SegmentedControlContext";
import { segmentedControlThumbCSS } from "./styles";

/**
 * Positions the track-owned thumb over the currently selected item.
 *
 * Everything here works in the track's own coordinate space: `offsetLeft` and
 * `offsetWidth` are measured against the item's offset parent, which is the
 * track. Movement of the page around the control — content loading, scroll
 * anchoring, other layout effects — cannot reach these numbers. The vertical
 * axis is a stylesheet constant that no code path writes, so a vertical
 * excursion of the thumb is unrepresentable, not merely compensated for.
 *
 * (The previous architecture, react-aria's `SelectionIndicator`, re-parented a
 * thumb between items and seeded its slide from `getBoundingClientRect`
 * deltas taken at two different moments. Any reflow between those two
 * measurements leaked into the seed as a vertical delta, and the thumb
 * animated in from outside the control. Patching the seeded style after the
 * fact could not hold: react-aria had already committed the seed as the
 * transition's start point and restored its own values a frame later.)
 */
function createThumbRegistry(thumbRef: RefObject<HTMLDivElement | null>) {
  let selectedItem: HTMLElement | null = null;
  let appliedPosition: string | null = null;
  let observer: ResizeObserver | null = null;

  const position = (animate: boolean) => {
    const thumb = thumbRef.current;
    if (!thumb) {
      return;
    }
    if (!selectedItem || !selectedItem.isConnected) {
      // Back to the stylesheet's hidden state until an item registers.
      thumb.style.visibility = "";
      appliedPosition = null;
      return;
    }
    const left = `calc(${selectedItem.offsetLeft}px - var(--global-border-size-thin))`;
    const width = `calc(${selectedItem.offsetWidth}px + 2 * var(--global-border-size-thin))`;
    const nextPosition = `${left} ${width}`;
    // A ResizeObserver delivers an initial entry right after observe();
    // skipping unchanged geometry keeps that entry from snapping a slide that
    // just started.
    if (nextPosition === appliedPosition) {
      return;
    }
    appliedPosition = nextPosition;
    if (!animate) {
      thumb.style.transitionProperty = "none";
    }
    thumb.style.left = left;
    thumb.style.width = width;
    thumb.style.visibility = "visible";
    if (!animate) {
      // Flush the untransitioned styles so restoring the transition cannot
      // animate the reposition we just made.
      void thumb.offsetWidth;
      thumb.style.transitionProperty = "";
    }
  };

  return {
    registerSelectedItem(item: HTMLElement) {
      // Sliding is for selection moving between items; the first item to
      // register (or the first after the control emptied) appears in place.
      const hadSelection = appliedPosition != null;
      selectedItem = item;
      observer ??=
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => position(false));
      observer?.disconnect();
      observer?.observe(item);
      if (item.parentElement) {
        // Sibling and track size changes move the item without resizing it.
        observer?.observe(item.parentElement);
      }
      position(hadSelection);
      return () => {
        if (selectedItem !== item) {
          return;
        }
        selectedItem = null;
        observer?.disconnect();
        // Selection normally moves to another item in the same commit; only
        // hide once the commit settles with nothing re-registered.
        queueMicrotask(() => {
          if (selectedItem === null) {
            position(false);
          }
        });
      };
    },
    dispose() {
      observer?.disconnect();
      observer = null;
      selectedItem = null;
      appliedPosition = null;
    },
  };
}

/**
 * The single persistent thumb element plus the registry the items report to.
 * Render `thumb` as a direct child of the track so its containing block — and
 * therefore every coordinate it can ever hold — is the track itself.
 */
export function useSegmentedControlThumb() {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [registry] = useState<
    SegmentedControlSelectionRegistry & { dispose: () => void }
  >(() => createThumbRegistry(thumbRef));
  useEffect(() => () => registry.dispose(), [registry]);
  const thumb = (
    <div
      ref={thumbRef}
      aria-hidden="true"
      className="segmented-control__thumb"
      css={segmentedControlThumbCSS}
    />
  );
  return { thumb, registry };
}
