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

/** Elements whose scroll keys edit text rather than scroll the container */
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

export type SectionNavItem = {
  /** The `id` of the `SectionNavSection` this link scrolls to */
  id: string;
  /**
   * The link's text. It stays on one line; a bar too narrow for every label
   * scrolls sideways.
   */
  label: string;
};

export type SectionNavOrientation = "horizontal" | "vertical";

export interface SectionNavProps extends StylableProps {
  /** Names the navigation landmark, e.g. "Run details" */
  "aria-label": string;
  /**
   * One link per section, in the order the sections render. Each `id` must
   * match the `id` of a `SectionNavSection`.
   */
  sections: readonly SectionNavItem[];
  /**
   * The element that scrolls the sections. Pass it whenever the nav is not
   * inside that element, as in the usual layout with the nav above or beside
   * it. Without it, the nav uses its own nearest scrollable ancestor, or the
   * document.
   */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /**
   * `"horizontal"` is a bar of links above the sections; `"vertical"` is a
   * rail beside them.
   * @default "horizontal"
   */
  orientation?: SectionNavOrientation;
  /**
   * The section that is current on mount, e.g. one restored from the URL
   * hash. The pane scrolls to it on mount, and it stays current until the
   * user scrolls. Without it, the first section is current and the pane does
   * not scroll.
   */
  defaultActiveId?: string;
  /**
   * Called with the section id whenever the current link changes, from a
   * click or from scrolling, but not on mount. Link clicks do not write the
   * URL hash; use this to sync it.
   */
  onChange?: (activeId: string) => void;
  /**
   * Whether a link click, or the mount scroll to `defaultActiveId`, scrolls
   * smoothly rather than jumping. It always jumps when the user prefers
   * reduced motion.
   * @default true
   */
  isScrollAnimated?: boolean;
  className?: string;
  /** The `<nav>` element */
  ref?: Ref<HTMLElement>;
}

function isDocumentScroller(element: Element) {
  const doc = element.ownerDocument;
  return element === doc.scrollingElement || element === doc.documentElement;
}

/**
 * Scrollspy navigation for one scrolling pane: a bar of links, or a rail, to
 * the `SectionNavSection`s in that pane. Every section stays rendered.
 * Clicking a link scrolls the pane to its section and moves focus into it. As
 * the user scrolls, the current link follows the last section whose top has
 * reached the line where clicked sections land, or the last section once the
 * pane is scrolled to its end.
 *
 * It is a `<nav>` landmark of in-page links with `aria-current` on the current
 * one, not a tablist: unlike `Tabs`, it switches no panels and takes no arrow
 * keys.
 *
 * Layout:
 * - Render the nav above the element that scrolls the sections, or beside it
 *   for a rail, and pass that element as `scrollContainerRef`. The scrollbar
 *   then spans only the sections.
 * - A nav inside the scroll container also works. It sticks to the top of the
 *   container, and sections land below it.
 * - Sections land a gap below the top of the pane. Set
 *   `--section-nav-scroll-inset` on the scroll container to match its
 *   padding.
 * - Section ids must be unique within the document.
 * - Every link can bring its section to the top, even the last one or a pane
 *   taller than its content: when the content after the last section is
 *   shorter than the pane, the nav adds space below that section, as a
 *   bottom margin, so the pane can scroll it up to the landing line.
 *
 * @example
 * const bodyRef = useRef<HTMLDivElement>(null);
 * <SectionNav
 *   aria-label="Run details"
 *   sections={[
 *     { id: "input", label: "Input" },
 *     { id: "output", label: "Output" },
 *   ]}
 *   scrollContainerRef={bodyRef}
 * />
 * <div ref={bodyRef} css={scrollingBodyCSS}>
 *   <SectionNavSection id="input" heading="Input">…</SectionNavSection>
 *   <SectionNavSection id="output" heading="Output">…</SectionNavSection>
 * </div>
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

  // The id last made current, rather than the committed `activeId`, so two
  // resolves before React re-renders report a change once
  const reportedActiveIdRef = useRef(activeId);
  const changeActiveId = (id: string) => {
    if (id === reportedActiveIdRef.current) {
      return;
    }
    reportedActiveIdRef.current = id;
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

    // The space added below the last section so the pane can scroll it up to
    // the line where sections land: without it, a short last section, or a
    // pane taller than its content, cannot reach that line. The section's
    // own margin is kept underneath; the runout is the part added on top.
    let runoutSection: HTMLElement | null = null;
    let runoutMargin = 0;
    let runout = 0;
    const clearRunout = () => {
      runoutSection?.style.removeProperty("margin-block-end");
      runoutSection = null;
      runout = 0;
    };
    const setRunout = ({
      section,
      nextRunout,
    }: {
      section: HTMLElement;
      nextRunout: number;
    }) => {
      if (nextRunout <= 0) {
        clearRunout();
        return;
      }
      section.style.setProperty(
        "margin-block-end",
        `${runoutMargin + nextRunout}px`
      );
      runoutSection = section;
      runout = nextRunout;
    };
    const updateRunout = () => {
      const lastSection = getSectionElements().at(-1) ?? null;
      if (lastSection !== runoutSection) {
        clearRunout();
      }
      if (lastSection == null) {
        return;
      }
      if (runoutSection == null) {
        runoutMargin =
          Number.parseFloat(win.getComputedStyle(lastSection).marginBlockEnd) ||
          0;
      }
      const viewportTop = getViewportTop();
      const lastSectionRect = lastSection.getBoundingClientRect();
      // The scroll height that lets the pane land the last section on the line
      const requiredScrollHeight =
        container.scrollTop +
        lastSectionRect.top -
        viewportTop -
        getScrollMarginTop(lastSection) +
        container.clientHeight;
      // A pane taller than its content reports its own height as its scroll
      // height, which hides what follows the last section (e.g. the padding
      // it sits in). Overshoot first, assuming nothing follows it, so the
      // content outgrows the pane and the next measurement is exact.
      if (container.scrollHeight <= container.clientHeight) {
        const lastSectionBottom =
          container.scrollTop + lastSectionRect.bottom - viewportTop;
        setRunout({
          section: lastSection,
          nextRunout: Math.ceil(
            requiredScrollHeight - lastSectionBottom - runoutMargin
          ),
        });
      }
      const scrollHeightWithoutRunout = container.scrollHeight - runout;
      const nextRunout = Math.max(
        0,
        Math.ceil(requiredScrollHeight - scrollHeightWithoutRunout)
      );
      if (nextRunout !== runout) {
        setRunout({ section: lastSection, nextRunout });
      }
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
          // to another section (e.g. after landing a fraction of a pixel short
          // of the line)
          tracking.pause("holdingDefaultSection");
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
      tracking.recordScroll();
      scheduleSettle();
    };
    const handleUserScrollInput = () => tracking.recordUserScrollInput();
    // A press on the container's own scrollbar targets the container itself;
    // a press on its content (a button, a field) does not scroll it
    const handlePointerDown = (event: Event) => {
      if (event.target === container) {
        tracking.recordUserScrollInput();
      }
    };
    // A scroll key typed into a field, or handled by a control, scrolls nothing
    const handleKeyDown = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        SCROLL_KEYS.has(event.key) &&
        !event.defaultPrevented &&
        !(
          event.target instanceof Element &&
          event.target.closest(EDITABLE_SELECTOR) != null
        )
      ) {
        tracking.recordUserScrollInput();
      }
    };
    const pauseUntilSettled = (reason: ScrollTrackingPauseReason) => {
      tracking.pause(reason);
      scheduleSettle();
    };
    // Unlike `scrollIntoView`, which also scrolls every scrollable ancestor
    // (e.g. the page around the pane), this moves only the container
    const scrollToSection = (section: HTMLElement) => {
      pauseUntilSettled("programmaticallyScrolling");
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
      updateRunout();
      observeSections();
      resolve();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(nav);
    if (!isDocument) {
      resizeObserver.observe(container);
    }
    // A section that grows or shrinks changes the runout the last one needs
    for (const element of getSectionElements()) {
      resizeObserver.observe(element);
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
    scrollEventTarget.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });

    updateBarHeight();
    updateRunout();
    const heldDefaultId = heldDefaultIdRef.current;
    if (heldDefaultId != null) {
      // Only one of the nav's sections, not any element sharing the id
      const defaultSection = sectionIds.includes(heldDefaultId)
        ? doc.getElementById(heldDefaultId)
        : null;
      // Re-runs before the user scrolls land it in the same place again
      if (defaultSection == null) {
        pauseUntilSettled("holdingDefaultSection");
      } else {
        scrollToSection(defaultSection);
      }
    }
    observeSections();

    return () => {
      clearTimeout(settleTimeout);
      // A user who scrolled before the re-run has released the held default,
      // so the next setup must not scroll back to it
      if (tracking.settle()) {
        heldDefaultIdRef.current = null;
      }
      scrollToSectionRef.current = () => {};
      observer?.disconnect();
      resizeObserver.disconnect();
      win.removeEventListener("resize", handleResize);
      scrollEventTarget.removeEventListener("scroll", handleScroll);
      scrollEventTarget.removeEventListener("scrollend", settle);
      scrollEventTarget.removeEventListener("wheel", handleUserScrollInput);
      scrollEventTarget.removeEventListener("touchmove", handleUserScrollInput);
      scrollEventTarget.removeEventListener("keydown", handleKeyDown);
      scrollEventTarget.removeEventListener("pointerdown", handlePointerDown);
      container.style.removeProperty("--section-nav-height");
      clearRunout();
    };
  }, [sectionIdsKey, scrollContainerRef, orientation]);

  const handleLinkClick = ({
    event,
    id,
  }: {
    event: MouseEvent<HTMLAnchorElement>;
    id: string;
  }) => {
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
                  onClick={(event) =>
                    handleLinkClick({ event, id: section.id })
                  }
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
