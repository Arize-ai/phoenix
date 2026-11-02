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
   * The section marked active on mount, e.g. one restored from the URL hash.
   * The pane scrolls to it on mount, animated as `isScrollAnimated` says, and
   * it stays active until the user scrolls. Defaults to the first section,
   * which neither scrolls the pane nor holds it.
   */
  defaultActiveId?: string;
  /** Called with the new section id when the active section changes */
  onChange?: (activeId: string) => void;
  /**
   * Whether clicking a link (or mounting with `defaultActiveId`) smoothly
   * scrolls to its section rather than jumping there. Ignored, and the scroll
   * jumps, when the user prefers reduced motion.
   * @default true
   */
  isScrollAnimated?: boolean;
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
 * Render the nav above (or, for a rail, beside) the element that scrolls the
 * sections and pass that element as `scrollContainerRef`, so the scrollbar
 * spans only the sections. A nav inside the scroll container also works: it
 * sticks to the container's top and sections land below it. Sections land a
 * padding-sized gap below the top; set `--section-nav-scroll-inset` on the
 * container to match its padding. Section ids must be unique within the
 * document.
 */
export function SectionNav({
  "aria-label": ariaLabel,
  sections,
  scrollContainerRef,
  orientation = "horizontal",
  defaultActiveId,
  onChange,
  isScrollAnimated = true,
  css: _css,
  className,
  ref,
}: SectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    defaultActiveId ?? sections[0]?.id ?? null
  );
  const navRef = useRef<HTMLElement | null>(null);
  const trackingRef = useRef(createScrollTracking());
  // The `defaultActiveId` still held, until the user scrolls, across effect
  // re-runs (e.g. Strict Mode's or a changed section set) before then
  const heldDefaultIdRef = useRef(defaultActiveId ?? null);
  // Scrolls a section to just below the bar within the scroll container
  // alone, holding its link current meanwhile; set up by the effect, which
  // resolves the container and owns the settle timer
  const scrollToSectionRef = useRef<(section: HTMLElement) => void>(() => {});
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)"
  );
  // "instant" rather than "auto", which would defer to a `scroll-behavior:
  // smooth` on the container and animate regardless
  const scrollBehavior: ScrollBehavior =
    isScrollAnimated && !prefersReducedMotion ? "smooth" : "instant";
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
  const getScrollBehavior = useEffectEvent(() => scrollBehavior);

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
    // How far below the top of the container's viewport a section lands: its
    // `scroll-margin-top`, the bar's height plus a padding-sized gap by
    // default. Clicks and `#id` jumps land a section there, and a section
    // counts as reached once its top scrolls up to it.
    const getScrollMarginTop = (element: Element) =>
      Number.parseFloat(win.getComputedStyle(element).scrollMarginTop) || 0;

    const resolve = () => {
      if (tracking.isPaused) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = container;
      const activeSectionId = resolveActiveSectionId({
        sections: getSectionElements().map((element) => ({
          id: element.id,
          top:
            element.getBoundingClientRect().top - getScrollMarginTop(element),
        })),
        lineTop: getViewportTop(),
        // A pane that does not scroll at all shows its first section as
        // active, not its last.
        isScrolledToEnd:
          scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 1,
      });
      if (activeSectionId != null) {
        onScrollPositionResolved(activeSectionId);
      }
    };

    // The observer watches a one pixel band along the line where sections
    // land, so it reports exactly when a section's top or bottom crosses it —
    // the only moments the active section can change mid-scroll.
    let observer: IntersectionObserver | null = null;
    const observeSections = () => {
      observer?.disconnect();
      const sectionElements = getSectionElements();
      if (sectionElements.length === 0) {
        return;
      }
      // A negative margin would make an invalid `--Npx` root margin
      const bandTop = Math.max(0, getScrollMarginTop(sectionElements[0]));
      const bandBottom = Math.max(0, getViewportHeight() - bandTop - 1);
      observer = new IntersectionObserver(resolve, {
        root: isDocument ? null : container,
        rootMargin: `-${bandTop}px 0px -${bandBottom}px 0px`,
      });
      for (const element of sectionElements) {
        observer.observe(element);
      }
    };

    // Sections land below the bar: their default `scroll-margin-top` reads
    // this.
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
        if (!shouldResolve && heldDefaultIdRef.current != null) {
          // The scroll to the held default settled without the user
          // scrolling; keep holding it, since the scroll position may resolve
          // to another section (e.g. one the pane cannot scroll to the top)
          tracking.pause("defaultActiveId");
          return;
        }
        heldDefaultIdRef.current = null;
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
    const pauseUntilSettled = (reason: ScrollTrackingPauseReason) => {
      tracking.pause(reason);
      scheduleSettle();
    };
    // Unlike `scrollIntoView`, which also scrolls every scrollable ancestor
    // (e.g. the page around the pane), this moves only the container
    const scrollToSection = (section: HTMLElement) => {
      pauseUntilSettled("scrollToSection");
      const top =
        container.scrollTop +
        section.getBoundingClientRect().top -
        getViewportTop() -
        getScrollMarginTop(section);
      scrollEventTarget.scrollTo({ top, behavior: getScrollBehavior() });
    };
    scrollToSectionRef.current = scrollToSection;

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
    const heldDefaultId = heldDefaultIdRef.current;
    if (heldDefaultId != null) {
      // Only one of the nav's sections, not any element sharing the id
      const defaultSection = sectionIds.includes(heldDefaultId)
        ? doc.getElementById(heldDefaultId)
        : null;
      // Re-runs before the user scrolls land it in the same place again
      if (defaultSection == null) {
        pauseUntilSettled("defaultActiveId");
      } else {
        scrollToSection(defaultSection);
      }
    }
    observeSections();

    return () => {
      clearTimeout(settleTimeout);
      tracking.settle();
      scrollToSectionRef.current = () => {};
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
    // The click replaces the held default, so neither its settle nor an
    // effect re-run scrolls back to it
    heldDefaultIdRef.current = null;
    scrollToSectionRef.current(section);
    changeActiveId(id);
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
