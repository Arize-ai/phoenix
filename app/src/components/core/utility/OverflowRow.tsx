import { css } from "@emotion/react";
import type { CSSProperties, PropsWithChildren } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button as AriaButton, DialogTrigger } from "react-aria-components";

import { StopPropagation } from "@phoenix/components/StopPropagation";
import { classNames } from "@phoenix/utils/classNames";

import { Dialog } from "../dialog";
import { Flex } from "../layout";
import { Popover, PopoverArrow } from "../overlay";
import { outlinedPillCSS } from "../styles";
import { View } from "../view";

type FirstLine = {
  /** How many items share the first line and are shown by the row itself */
  visibleCount: number;
  /** The right edge of the last visible item, where the badge is placed */
  badgeLeft: number;
  /** The measured height of the first line, which the row clamps to */
  lineHeight: number;
};

/** What the row renders from, once the hidden items are counted */
type OverflowState = FirstLine & {
  /** How many items wrapped past the first line and are hidden */
  hiddenCount: number;
};

const overflowRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
  min-width: 0;
  max-width: 100%;

  &.overflow-row--collapsed {
    position: relative;
    // Items that don't fit wrap to lines below the measured clamp and are cut
    // off whole. They are also made inert, so nothing that the row is cutting
    // off can take focus or reach the accessibility tree — the "+N" badge
    // stands in for them.
    align-content: flex-start;
    overflow: clip;
  }
  &.overflow-row--overflowing {
    // The clamp is the first line's measured height rather than a fixed
    // dimension, so the items decide how tall the row is and are never
    // cropped mid-pill.
    height: var(--overflow-row-line-height);
    // room for the badge, which sits out of flow at the end of the first line
    padding-right: var(--global-dimension-size-600);
  }

  // The badge and its popover are the row's own output rather than items, so
  // they are kept in a boxless slot: the measurement skips them for free, and
  // the content observer can tell the row's own changes from its children's.
  .overflow-row__badge-slot {
    display: contents;
  }

  // The badge stands in for the pills it hides, so it wears the shared pill
  // shell. It is an unstyled react-aria button, so the rest of its dress is
  // declared here.
  .overflow-row__badge {
    ${outlinedPillCSS};
    position: absolute;
    left: var(--overflow-row-badge-left);
    top: 50%;
    transform: translateY(-50%);
    box-sizing: border-box;
    height: var(--overflow-row-line-height);
    padding: 0 var(--global-dimension-size-100);
    background-color: transparent;
    color: var(--global-text-color-700);
    font-family: inherit;
    font-size: var(--global-font-size-s);
    line-height: normal;
    &:hover {
      color: var(--global-text-color-900);
    }
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    }
  }
`;

/** What {@link measureOverflow} reads off the DOM */
type OverflowMeasurement = FirstLine & {
  /** The child elements that render a box, in document order */
  items: HTMLElement[];
};

/** Whether an element renders a box, and so counts as an item */
function hasBox(element: HTMLElement): boolean {
  return element.offsetWidth > 0 || element.offsetHeight > 0;
}

/**
 * Collects the container's items. Only elements that render a box are items —
 * boxless wrappers (display: contents event guards and badge slot, closed
 * popovers) are skipped.
 */
function getItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && hasBox(element)
  );
}

/**
 * Measures which of the container's items fit on its first line.
 */
function measureOverflow(container: HTMLElement): OverflowMeasurement {
  const items = getItems(container);
  let visibleCount = 0;
  let badgeLeft = 0;
  let lineHeight = 0;
  // `align-items: center` cross-centers the items, so items sharing a line do
  // not share an offsetTop. Flex lines never overlap vertically though, so
  // line membership is an overlap test against the band the first line has
  // covered so far rather than a comparison of top edges.
  let lineTop = Number.POSITIVE_INFINITY;
  let lineBottom = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (visibleCount > 0 && (top >= lineBottom || bottom <= lineTop)) {
      // Items lay out in document order, so everything after the first wrap
      // is on a later line too.
      break;
    }
    visibleCount += 1;
    lineTop = Math.min(lineTop, top);
    lineBottom = Math.max(lineBottom, bottom);
    badgeLeft = Math.max(badgeLeft, item.offsetLeft + item.offsetWidth);
    lineHeight = Math.max(lineHeight, item.offsetHeight);
  }
  return { items, visibleCount, badgeLeft, lineHeight };
}

/**
 * The attributes that hide a clipped item, each recorded on the element under
 * its own flag so that only the ones this row actually added are ever removed.
 */
const CLIPPED_ITEM_ATTRIBUTES = [
  { name: "inert", value: "", flag: "overflowRowInert" },
  { name: "aria-hidden", value: "true", flag: "overflowRowAriaHidden" },
] as const;

/**
 * Takes the clipped items out of the tab order and the accessibility tree.
 * They are still rendered — only cut off — so without this a keyboard user
 * would focus a pill that `overflow: clip` forbids the browser from scrolling
 * into view, and a screen reader would read items the row does not show. The
 * badge's popover is the one place they are exposed.
 */
function setClippedItems({
  items,
  visibleCount,
}: {
  items: HTMLElement[];
  visibleCount: number;
}) {
  items.forEach((item, index) => {
    if (index < visibleCount) {
      restoreClippedItem(item);
      return;
    }
    for (const { name, value, flag } of CLIPPED_ITEM_ATTRIBUTES) {
      // A child that already hides itself keeps ownership of the attribute, so
      // restoring cannot delete state React would not put back. This is also
      // what makes a second pass over an already-clipped item a no-op.
      if (!item.hasAttribute(name)) {
        item.dataset[flag] = "true";
        item.setAttribute(name, value);
      }
    }
  });
}

/** Undoes only what {@link setClippedItems} applied, never a child's own state */
function restoreClippedItem(element: HTMLElement) {
  for (const { name, flag } of CLIPPED_ITEM_ATTRIBUTES) {
    if (element.dataset[flag]) {
      delete element.dataset[flag];
      element.removeAttribute(name);
    }
  }
}

function restoreClippedItems(container: HTMLElement) {
  for (const element of Array.from(container.children)) {
    if (element instanceof HTMLElement) {
      restoreClippedItem(element);
    }
  }
}

/** How the row watches its items for changes it cannot see as a resize */
const CONTENT_OBSERVER_OPTIONS = {
  childList: true,
  characterData: true,
  subtree: true,
} as const satisfies MutationObserverInit;

/**
 * Whether a mutation is the row's own "+N" badge appearing, leaving or
 * recounting. The badge is an output of the measurement, so re-measuring for
 * it would only ever arrive back at the same answer.
 */
function isBadgeMutation(record: MutationRecord): boolean {
  const isInBadgeSlot = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest(".overflow-row__badge-slot") != null;
  };
  if (record.type === "childList") {
    return [...record.addedNodes, ...record.removedNodes].every(isInBadgeSlot);
  }
  return isInBadgeSlot(record.target);
}

function isSameOverflow(a: OverflowState | null, b: OverflowState | null) {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.hiddenCount === b.hiddenCount &&
    a.visibleCount === b.visibleCount &&
    a.badgeLeft === b.badgeLeft &&
    a.lineHeight === b.lineHeight
  );
}

/**
 * The body of the "+N" popover: the same children the row renders, minus the
 * ones already visible in the row. The children compose through component
 * boundaries (fragments, connected components), so they cannot be sliced as a
 * React array — instead the full set renders again and the leading elements
 * that the row already shows are switched off by DOM position, using the
 * row's own first-line count. `display: none` keeps them out of the
 * accessibility tree, so together with the row's inert clipped items every
 * item is exposed exactly once.
 */
function OverflowRowPopoverItems({
  visibleCount,
  children,
}: PropsWithChildren<{ visibleCount: number }>) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) {
      return undefined;
    }
    const hideRowVisibleItems = () => {
      const all = Array.from(container.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement
      );
      // Undo only the hiding this effect applied before deciding which elements
      // are items. Clearing every child's inline display would be simpler, but
      // some children own theirs (the display: contents event guards), and
      // React would not restore what we wipe.
      for (const element of all) {
        if (element.dataset.overflowRowHidden) {
          element.style.display = "";
          delete element.dataset.overflowRowHidden;
        }
      }
      // Only elements that render a box are items; the children also produce
      // boxless wrappers (display: contents event guards, closed popovers) that
      // must not throw off the position count.
      const items = all.filter(hasBox);
      items.slice(0, visibleCount).forEach((element) => {
        element.style.display = "none";
        element.dataset.overflowRowHidden = "true";
      });
    };
    hideRowVisibleItems();
    // The items can change under an open popover (a streaming refetch). Watching
    // for that is push-based, so a parent render that changed nothing costs no
    // reflow — and the inline display written above is an attribute, which the
    // observer does not watch and so cannot feed back into it.
    const observer = new MutationObserver(hideRowVisibleItems);
    observer.observe(container, CONTENT_OBSERVER_OPTIONS);
    return () => observer.disconnect();
  }, [visibleCount]);
  return (
    <Flex
      ref={ref}
      direction="row"
      wrap="wrap"
      gap="size-50"
      maxWidth="size-5000"
    >
      {children}
    </Flex>
  );
}

/**
 * A single-line row of items (annotation labels, tags) that hides whatever
 * doesn't fit behind a "+N" badge, which opens the hidden items in a popover.
 * When `isExpanded`, the row simply wraps instead.
 *
 * The items are measured where they render: the row lets flex wrapping push
 * items that don't fit onto clipped lines, then counts the items that left the
 * first line. Nothing is ever cut mid-item, and the measurement never has to
 * know what the items are — any composed children that render a flat run of
 * elements (fragments included) work.
 */
export function OverflowRow({
  children,
  isExpanded = false,
}: PropsWithChildren<{
  /** Whether the row wraps all of its items rather than clipping to one line */
  isExpanded?: boolean;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const remeasureRef = useRef<(() => void) | null>(null);
  const [overflow, setOverflow] = useState<OverflowState | null>(null);

  // The observer lives for as long as the row is collapsed — it is not torn
  // down when the items re-render, only when the row changes shape.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (isExpanded || !container) {
      setOverflow(null);
      return undefined;
    }
    // The row's own border-box width as of the last measurement. Seeded by the
    // measurement itself so the observer's mandatory initial delivery, which
    // reports the width we already measured at, costs nothing.
    let lastInlineSize: number | null = null;
    const remeasure = () => {
      lastInlineSize = container.getBoundingClientRect().width;
      const { items, visibleCount, badgeLeft, lineHeight } =
        measureOverflow(container);
      setClippedItems({ items, visibleCount });
      const hiddenCount = items.length - visibleCount;
      const next =
        hiddenCount === 0
          ? null
          : { hiddenCount, visibleCount, badgeLeft, lineHeight };
      setOverflow((prev) => (isSameOverflow(prev, next) ? prev : next));
    };
    // measure synchronously so the first paint is already clamped
    remeasure();
    remeasureRef.current = remeasure;
    // A web font swapping in re-lays the items out without changing the row's
    // width or any of its text, so nothing else would catch it. Rows that mount
    // once the fonts have settled — every row after the first paint — have
    // nothing to wait for.
    let isUnmounted = false;
    if (document.fonts?.status === "loading") {
      void document.fonts.ready.then(() => {
        if (!isUnmounted) {
          remeasure();
        }
      });
    }
    // Only a change in the row's inline size can re-wrap the items. Ignoring
    // the block size stops the clamp this callback applies from feeding back
    // into the observer that watches the very element it clamps, which
    // browsers report as a ResizeObserver loop.
    const resizeObserver = new ResizeObserver(([entry]) => {
      const inlineSize = entry?.borderBoxSize?.[0]?.inlineSize ?? null;
      if (inlineSize !== null && inlineSize === lastInlineSize) {
        return;
      }
      lastInlineSize = inlineSize;
      remeasure();
    });
    resizeObserver.observe(container);
    // The resize observer only sees the row's own width; items swapped for a
    // same-size set (e.g. a streaming refetch) change its contents instead.
    // Watching for that is push-based, so a render that changed nothing costs
    // no reflow.
    const contentObserver = new MutationObserver((records) => {
      if (records.every(isBadgeMutation)) {
        return;
      }
      remeasure();
    });
    contentObserver.observe(container, CONTENT_OBSERVER_OPTIONS);
    return () => {
      isUnmounted = true;
      resizeObserver.disconnect();
      contentObserver.disconnect();
      remeasureRef.current = null;
      restoreClippedItems(container);
    };
  }, [isExpanded]);

  // Clamping reserves room for the badge, which narrows the content box and
  // can push one more item onto a clipped line. Measure once more against the
  // clamped geometry; the count only ever grows, so this settles immediately.
  useLayoutEffect(() => {
    if (overflow !== null) {
      remeasureRef.current?.();
    }
  }, [overflow]);

  return (
    <div
      ref={containerRef}
      css={overflowRowCSS}
      className={classNames("overflow-row", {
        "overflow-row--collapsed": !isExpanded,
        "overflow-row--overflowing": !isExpanded && overflow !== null,
      })}
      style={
        overflow !== null
          ? ({
              "--overflow-row-badge-left": `calc(${overflow.badgeLeft}px + var(--global-dimension-size-50))`,
              "--overflow-row-line-height": `${overflow.lineHeight}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {children}
      {!isExpanded && overflow !== null ? (
        <div className="overflow-row__badge-slot">
          <DialogTrigger>
            <AriaButton
              className="overflow-row__badge"
              data-clickable="true"
              aria-label={`Show ${overflow.hiddenCount} more`}
            >
              +{overflow.hiddenCount}
            </AriaButton>
            <StopPropagation>
              <Popover placement="bottom end">
                <PopoverArrow />
                <Dialog>
                  <View padding="size-150">
                    <OverflowRowPopoverItems
                      visibleCount={overflow.visibleCount}
                    >
                      {children}
                    </OverflowRowPopoverItems>
                  </View>
                </Dialog>
              </Popover>
            </StopPropagation>
          </DialogTrigger>
        </div>
      ) : null}
    </div>
  );
}
