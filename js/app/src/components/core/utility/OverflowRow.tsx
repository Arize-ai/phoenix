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

/** The badge's wrapper, the one child that is the row's own output */
const BADGE_SLOT_CLASS = "overflow-row__badge-slot";

type FirstLine = {
  visibleCount: number;
  /** The right edge of the last visible item, where the badge is placed */
  badgeLeft: number;
  lineHeight: number;
};

type OverflowState = FirstLine & {
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
  // the badge's reserved padding comes out of the row's width rather than
  // widening it
  box-sizing: border-box;

  &.overflow-row--collapsed {
    position: relative;
    // items that don't fit wrap to lines below the clamp and are cut off whole
    align-content: flex-start;
    overflow: clip;
  }
  &.overflow-row--overflowing {
    height: var(--overflow-row-line-height);
    // room for the badge, which sits out of flow at the end of the first line
    padding-right: var(--global-dimension-size-600);
  }

  // Not even the first item fits. The items stay in flow so they can still be
  // measured when the row is given its width back. Items may sit behind
  // boxless wrappers; visibility inherits through those, so hiding the
  // children reaches them.
  &.overflow-row--badge-only {
    min-width: var(--global-dimension-size-600);
    > *:not(.${BADGE_SLOT_CLASS}) {
      visibility: hidden;
    }
  }

  // Boxless so the slot never lays out as a flex item of its own; measurement
  // and the content observer exclude it by class.
  .${BADGE_SLOT_CLASS} {
    display: contents;
  }

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

type OverflowMeasurement = FirstLine & {
  /** The child elements that render a box, in document order */
  items: HTMLElement[];
};

/**
 * `offsetLeft`, `offsetWidth` and `clientWidth` each round to a whole pixel, so
 * the fit comparison carries up to half a pixel of error from each. An item
 * this close still fits.
 */
const SUBPIXEL_TOLERANCE = 1.5;

function hasBox(element: HTMLElement): boolean {
  return element.offsetWidth > 0 || element.offsetHeight > 0;
}

/**
 * An item is an element that renders a box, optionally behind `display:
 * contents` wrappers (the event guard around each pill): such a wrapper lays
 * no box out itself — its children are the row's own flex items — so
 * resolution descends through it. The badge slot is the row's own output and
 * is skipped, as are boxless leftovers like closed popovers and bare text
 * (which can never be measured or clipped).
 */
function getItems(parent: HTMLElement): HTMLElement[] {
  return Array.from(parent.children).flatMap((child) => {
    if (
      !(child instanceof HTMLElement) ||
      child.classList.contains(BADGE_SLOT_CLASS)
    ) {
      return [];
    }
    if (hasBox(child)) {
      return [child];
    }
    return getComputedStyle(child).display === "contents"
      ? getItems(child)
      : [];
  });
}

/**
 * The right edge an item has to end within to count as shown. Excludes the
 * padding a clamped row reserves for the badge.
 */
function getContentRight(container: HTMLElement): number {
  const { paddingRight } = getComputedStyle(container);
  return container.clientWidth - (parseFloat(paddingRight) || 0);
}

/** Measures which of the container's items fit on its first line. */
function measureOverflow(container: HTMLElement): OverflowMeasurement {
  const items = getItems(container);
  const contentRight = getContentRight(container);
  let visibleCount = 0;
  let badgeLeft = 0;
  let lineHeight = 0;
  // `align-items: center` means items on one line don't share an offsetTop, so
  // line membership is a vertical overlap test against the band covered so far
  // rather than a comparison of top edges.
  let lineTop = Number.POSITIVE_INFINITY;
  let lineBottom = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (visibleCount > 0 && (top >= lineBottom || bottom <= lineTop)) {
      // document order, so everything past the first wrap is on a later line
      break;
    }
    const right = item.offsetLeft + item.offsetWidth;
    // an item wider than the row still lays out on the first line, so this is
    // what keeps it from rendering cut in half
    if (right > contentRight + SUBPIXEL_TOLERANCE) {
      break;
    }
    visibleCount += 1;
    lineTop = Math.min(lineTop, top);
    lineBottom = Math.max(lineBottom, bottom);
    badgeLeft = Math.max(badgeLeft, right);
    lineHeight = Math.max(lineHeight, item.offsetHeight);
  }
  return {
    items,
    visibleCount,
    badgeLeft,
    // the badge keeps the items' height even when it has taken every one
    lineHeight: lineHeight || (items[0]?.offsetHeight ?? 0),
  };
}

/** Each recorded under its own flag, so only what this row added is removed */
const CLIPPED_ITEM_ATTRIBUTES = [
  { name: "inert", value: "", flag: "data-overflow-row-inert" },
  { name: "aria-hidden", value: "true", flag: "data-overflow-row-aria-hidden" },
] as const;

const CLIPPED_ITEM_FLAG_SELECTOR = CLIPPED_ITEM_ATTRIBUTES.map(
  ({ flag }) => `[${flag}]`
).join(",");

/**
 * Takes the clipped items out of the tab order and the accessibility tree. They
 * are still rendered, only cut off, so without this a keyboard user would focus
 * a pill that `overflow: clip` forbids the browser from scrolling into view.
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
      // restoring cannot delete state React would not put back.
      if (!item.hasAttribute(name)) {
        item.setAttribute(flag, "true");
        item.setAttribute(name, value);
      }
    }
  });
}

/** Undoes only what {@link setClippedItems} applied, never a child's own state */
function restoreClippedItem(element: HTMLElement) {
  for (const { name, flag } of CLIPPED_ITEM_ATTRIBUTES) {
    if (element.hasAttribute(flag)) {
      element.removeAttribute(flag);
      element.removeAttribute(name);
    }
  }
}

function restoreClippedItems(container: HTMLElement) {
  // Items can sit inside display: contents wrappers, so the flagged elements
  // are found by their flags rather than by walking direct children.
  container
    .querySelectorAll<HTMLElement>(CLIPPED_ITEM_FLAG_SELECTOR)
    .forEach(restoreClippedItem);
}

const CONTENT_OBSERVER_OPTIONS = {
  childList: true,
  characterData: true,
  subtree: true,
} as const satisfies MutationObserverInit;

/**
 * The badge is an output of the measurement, so re-measuring for it would only
 * ever arrive back at the same answer.
 */
function isBadgeMutation(record: MutationRecord): boolean {
  const isInBadgeSlot = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest(`.${BADGE_SLOT_CLASS}`) != null;
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
 * The body of the "+N" popover: the children the row is hiding. They compose
 * through component boundaries (fragments, connected components) and so cannot
 * be sliced as a React array — instead the full set renders again and the
 * prefix the row already shows is switched off by DOM position. Paired with the
 * row's inert clipped items, that exposes every item to assistive tech once.
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
      // Undo only this effect's own hiding: some elements own their inline
      // display (the event guards), and React would not restore what we wipe.
      // Restoring first also gives hidden items their boxes back, so the item
      // resolution below sees the full set in order.
      container
        .querySelectorAll<HTMLElement>("[data-overflow-row-hidden]")
        .forEach((element) => {
          element.style.display = "";
          delete element.dataset.overflowRowHidden;
        });
      getItems(container)
        .slice(0, visibleCount)
        .forEach((element) => {
          element.style.display = "none";
          element.dataset.overflowRowHidden = "true";
        });
    };
    hideRowVisibleItems();
    // The items can change under an open popover (a streaming refetch). The
    // inline display written above is an attribute, which this does not watch
    // and so cannot feed back into.
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
 * Items are measured where they render: flex wrapping pushes what doesn't fit
 * onto clipped lines, and the row counts what left the first line. So nothing
 * is cut mid-item, and the row never has to know what its children are.
 *
 * Each item must be an element that renders a box, optionally behind
 * `display: contents` wrappers — bare text children are never measured,
 * clipped, or shown in the badge's popover, so wrap text in an element.
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

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (isExpanded || !container) {
      setOverflow(null);
      return undefined;
    }
    // Seeded by the measurement itself, so the resize observer's mandatory
    // initial delivery reports a width already measured at and costs nothing.
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
    // A font swapping in re-lays the items out without changing the row's width
    // or its text, so neither observer below would catch it.
    let isUnmounted = false;
    if (document.fonts?.status === "loading") {
      void document.fonts.ready.then(() => {
        if (!isUnmounted) {
          remeasure();
        }
      });
    }
    // Only a change in inline size can re-wrap the items. Ignoring block size
    // stops the clamp this callback applies from feeding back into the observer
    // watching the very element it clamps, which browsers report as a loop.
    const resizeObserver = new ResizeObserver(([entry]) => {
      const inlineSize = entry?.borderBoxSize?.[0]?.inlineSize ?? null;
      if (inlineSize !== null && inlineSize === lastInlineSize) {
        return;
      }
      lastInlineSize = inlineSize;
      remeasure();
    });
    resizeObserver.observe(container);
    // The resize observer only sees the row's width; items swapped for a
    // same-size set (a streaming refetch) change its contents instead.
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
        "overflow-row--badge-only":
          !isExpanded && overflow !== null && overflow.visibleCount === 0,
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
        <div className={BADGE_SLOT_CLASS}>
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
