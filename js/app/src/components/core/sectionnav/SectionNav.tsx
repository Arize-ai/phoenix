import { css } from "@emotion/react";
import { getScrollParent, mergeRefs } from "@react-aria/utils";
import type { MouseEvent, Ref, RefObject } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  SelectionIndicator,
  SharedElementTransition,
} from "react-aria-components";

import type { StylableProps } from "@phoenix/components/core/types";
import { useMediaQuery } from "@phoenix/hooks/useMediaQuery";
import { classNames } from "@phoenix/utils/classNames";

import { useHorizontalOverflow } from "../tabs/useHorizontalOverflow";
import { resolveActiveSectionId } from "./resolveActiveSectionId";
import {
  createScrollTracking,
  type ScrollTrackingPauseReason,
} from "./scrollTracking";
import { sectionNavCSS } from "./styles";

/**
 * How long scrolling must stop before the scroll counts as settled. Browsers
 * that fire `scrollend` settle sooner; this covers those that do not, and a
 * link click that turns out not to scroll at all.
 */
const SCROLL_SETTLE_MS = 150;

/** Keys that scroll the focused scroll container */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

export type SectionNavItem = {
  /** The `id` of the `SectionNavSection` this link scrolls to */
  id: string;
  label: string;
};

export type SectionNavOrientation = "horizontal" | "vertical";

export interface SectionNavProps extends StylableProps {
  /** Names the navigation landmark, e.g. "Run details" */
  "aria-label": string;
  /** One link per section, in the order the sections are rendered */
  sections: readonly SectionNavItem[];
  /**
   * The element that scrolls the sections. Defaults to the nav's nearest
   * scrollable ancestor (or the document).
   */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /**
   * A bar of links above the sections, or a rail beside them
   * @default "horizontal"
   */
  orientation?: SectionNavOrientation;
  /**
   * The section marked active until the user scrolls, e.g. one restored from
   * the URL hash. Does not scroll the pane. Defaults to the first section.
   */
  defaultActiveId?: string;
  /** Called with the new section id when the active section changes */
  onChange?: (activeId: string) => void;
  className?: string;
  ref?: Ref<HTMLElement>;
}

function isDocumentScroller(element: Element) {
  const doc = element.ownerDocument;
  return element === doc.scrollingElement || element === doc.documentElement;
}

/**
 * Scrollspy navigation over a single scrolling pane: a sticky row (or rail)
 * of links to `SectionNavSection`s rendered in the same pane. Clicking a link
 * scrolls its section into view and moves focus into it; the active link
 * follows the section currently under the bar as the user scrolls.
 *
 * Unlike `Tabs`, every section stays mounted and scrollable, so this is a
 * `<nav>` of in-page links (marked with `aria-current`), not a tablist.
 *
 * Render the nav as the first child of the scroll container (or, for a rail,
 * beside the sections inside it) so sticky positioning applies. Section ids
 * must be unique within the document.
 */
export function SectionNav({
  "aria-label": ariaLabel,
  sections,
  scrollContainerRef,
  orientation = "horizontal",
  defaultActiveId,
  onChange,
  css: _css,
  className,
  ref,
}: SectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    defaultActiveId ?? sections[0]?.id ?? null
  );
  const navRef = useRef<HTMLElement | null>(null);
  const trackingRef = useRef(createScrollTracking());
  // Hold `defaultActiveId` until the user scrolls, across effect re-runs
  // (e.g. Strict Mode's or a changed section set) that happen before then
  const isHoldingDefaultRef = useRef(defaultActiveId != null);
  // Pauses tracking until the scroll settles; set up by the effect, which owns
  // the settle timer
  const pauseTrackingRef = useRef<(reason: ScrollTrackingPauseReason) => void>(
    () => {}
  );
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)"
  );
  const {
    ref: listRef,
    hasOverflowAtStart,
    hasOverflowAtEnd,
  } = useHorizontalOverflow<HTMLUListElement>();

  const changeActiveId = (id: string) => {
    if (id === activeId) {
      return;
    }
    setActiveId(id);
    onChange?.(id);
  };
  const onScrollPositionResolved = useEffectEvent(changeActiveId);

  // Re-subscribe when the set of sections changes, not when the parent passes
  // a new but equal `sections` array.
  const sectionIdsKey = sections.map((section) => section.id).join("\n");

  useEffect(() => {
    const nav = navRef.current;
    if (nav == null) {
      return () => {};
    }
    const doc = nav.ownerDocument;
    const win = doc.defaultView ?? window;
    const sectionIds = sectionIdsKey === "" ? [] : sectionIdsKey.split("\n");
    const scrollParent = getScrollParent(nav);
    const container =
      scrollContainerRef?.current ??
      (scrollParent instanceof HTMLElement
        ? scrollParent
        : doc.documentElement);
    const isDocument = isDocumentScroller(container);
    const tracking = trackingRef.current;
    const scrollEventTarget: HTMLElement | Window = isDocument
      ? win
      : container;

    const getSectionElements = () =>
      sectionIds.flatMap((id) => {
        const element = doc.getElementById(id);
        return element == null ? [] : [element];
      });
    // The part of the container's viewport the bar covers. Only a horizontal
    // bar inside the container overlays the sections; a rail sits beside them
    // and a bar outside the container sits above it.
    const getBarHeight = () =>
      orientation === "horizontal" && container.contains(nav)
        ? nav.offsetHeight
        : 0;
    const getViewportTop = () =>
      isDocument
        ? 0
        : container.getBoundingClientRect().top + container.clientTop;
    const getViewportHeight = () =>
      isDocument ? win.innerHeight : container.clientHeight;

    const resolve = () => {
      if (tracking.isPaused) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = container;
      const activeSectionId = resolveActiveSectionId({
        sections: getSectionElements().map((element) => ({
          id: element.id,
          top: element.getBoundingClientRect().top,
        })),
        lineTop: getViewportTop() + getBarHeight(),
        // A pane that does not scroll at all shows its first section as
        // active, not its last.
        isScrolledToEnd:
          scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 1,
      });
      if (activeSectionId != null) {
        onScrollPositionResolved(activeSectionId);
      }
    };

    // The observer watches a one pixel band along the bar's bottom edge, so it
    // reports exactly when a section's top or bottom crosses that line — the
    // only moments the active section can change mid-scroll.
    let observer: IntersectionObserver | null = null;
    const observeSections = () => {
      observer?.disconnect();
      const bandTop = getBarHeight();
      const bandBottom = Math.max(0, getViewportHeight() - bandTop - 1);
      observer = new IntersectionObserver(resolve, {
        root: isDocument ? null : container,
        rootMargin: `-${bandTop}px 0px -${bandBottom}px 0px`,
      });
      for (const element of getSectionElements()) {
        observer.observe(element);
      }
    };

    // Sections land below the bar when scrolled into view (a link click, or
    // the browser following a `#id` URL).
    const updateBarHeight = () => {
      container.style.setProperty(
        "--section-nav-height",
        `${getBarHeight()}px`
      );
    };

    // Settling covers what the observer cannot see: a short last section that
    // becomes active at the end of the scroll without reaching the line.
    let settleTimeout: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(settleTimeout);
      const shouldResolve = tracking.settle();
      if (!tracking.isPaused) {
        isHoldingDefaultRef.current = false;
      }
      if (shouldResolve) {
        resolve();
      }
    };
    const scheduleSettle = () => {
      clearTimeout(settleTimeout);
      settleTimeout = setTimeout(settle, SCROLL_SETTLE_MS);
    };
    const handleScroll = () => {
      tracking.noteScroll();
      scheduleSettle();
    };
    const handleUserScrollInput = () => tracking.noteUserScrollInput();
    const handleKeyDown = (event: Event) => {
      if (event instanceof KeyboardEvent && SCROLL_KEYS.has(event.key)) {
        tracking.noteUserScrollInput();
      }
    };
    pauseTrackingRef.current = (reason) => {
      tracking.pause(reason);
      scheduleSettle();
    };

    const handleResize = () => {
      updateBarHeight();
      observeSections();
      resolve();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(nav);
    if (!isDocument) {
      resizeObserver.observe(container);
    }
    win.addEventListener("resize", handleResize);
    scrollEventTarget.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    scrollEventTarget.addEventListener("scrollend", settle);
    scrollEventTarget.addEventListener("wheel", handleUserScrollInput, {
      passive: true,
    });
    scrollEventTarget.addEventListener("touchmove", handleUserScrollInput, {
      passive: true,
    });
    scrollEventTarget.addEventListener("keydown", handleKeyDown);
    // a press on the container's own scrollbar
    scrollEventTarget.addEventListener("pointerdown", handleUserScrollInput, {
      passive: true,
    });

    updateBarHeight();
    if (isHoldingDefaultRef.current) {
      pauseTrackingRef.current("defaultActiveId");
    }
    observeSections();

    return () => {
      clearTimeout(settleTimeout);
      tracking.settle();
      pauseTrackingRef.current = () => {};
      observer?.disconnect();
      resizeObserver.disconnect();
      win.removeEventListener("resize", handleResize);
      scrollEventTarget.removeEventListener("scroll", handleScroll);
      scrollEventTarget.removeEventListener("scrollend", settle);
      scrollEventTarget.removeEventListener("wheel", handleUserScrollInput);
      scrollEventTarget.removeEventListener("touchmove", handleUserScrollInput);
      scrollEventTarget.removeEventListener("keydown", handleKeyDown);
      scrollEventTarget.removeEventListener(
        "pointerdown",
        handleUserScrollInput
      );
      container.style.removeProperty("--section-nav-height");
    };
  }, [sectionIdsKey, scrollContainerRef, orientation]);

  const handleLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    // Leave modified clicks (open in a new tab, etc.) to the browser
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const section = event.currentTarget.ownerDocument.getElementById(id);
    if (section == null) {
      return;
    }
    // Scroll the pane ourselves rather than following the link, which would
    // write the hash into the app's URL; `onChange` is there to opt into that.
    event.preventDefault();
    pauseTrackingRef.current("click");
    changeActiveId(id);
    section.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    // Land keyboard and screen reader users in the section, without a second,
    // instant scroll cutting the smooth one short
    section.focus({ preventScroll: true });
  };

  return (
    <nav
      ref={mergeRefs(navRef, ref)}
      aria-label={ariaLabel}
      className={classNames("section-nav", className)}
      data-orientation={orientation}
      css={css(sectionNavCSS, _css)}
    >
      <SharedElementTransition>
        <ul
          ref={listRef}
          className="section-nav__list"
          data-orientation={orientation}
          data-overflow-start={hasOverflowAtStart}
          data-overflow-end={hasOverflowAtEnd}
        >
          {sections.map((section) => {
            const isActive = section.id === activeId;
            return (
              <li key={section.id} className="section-nav__item">
                <a
                  href={`#${section.id}`}
                  className="section-nav__link"
                  aria-current={isActive ? "true" : undefined}
                  onClick={(event) => handleLinkClick(event, section.id)}
                >
                  <span
                    className="section-nav__label"
                    data-label={section.label}
                  >
                    <span>{section.label}</span>
                  </span>
                  <SelectionIndicator
                    className="section-nav__indicator"
                    isSelected={isActive}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </SharedElementTransition>
    </nav>
  );
}
