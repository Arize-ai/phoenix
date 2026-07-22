import { css } from "@emotion/react";
import { useEvent, useResizeObserver } from "@react-aria/utils";
import type { ComponentProps } from "react";
import React, { useEffect, useRef, useState } from "react";
import {
  SelectionIndicator as AriaSelectionIndicator,
  Tab as AriaTab,
  TabList as AriaTabList,
  type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel,
  type TabPanelProps as AriaTabPanelProps,
  type TabProps as AriaTabProps,
  Tabs as AriaTabs,
  type TabsProps as AriaTabsProps,
} from "react-aria-components";

import type { StylableProps } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

/**
 * Tracks whether a horizontally scrollable tab list has tabs hidden beyond
 * its start and/or end edges. Used to render a directional fade affordance on
 * the tab bar, since the scrollbar is hidden and macOS does not show one until
 * the user actively scrolls.
 *
 * Returns a ref to attach to the scroll container plus booleans for whether
 * content overflows past the start (left) and end (right) edges.
 */
function useHorizontalOverflow() {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflowAtStart, setHasOverflowAtStart] = useState(false);
  const [hasOverflowAtEnd, setHasOverflowAtEnd] = useState(false);

  const update = () => {
    const el = elementRef.current;
    if (!el) {
      return;
    }
    // The fade affordance only applies to horizontal tab lists; clear any
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
  // changes that don't resize it (tabs added or removed, count badges
  // updating) would go unnoticed. Those changes all flow through a React
  // render, so re-measure after every commit.
  useEffect(() => {
    update();
  });

  return { ref: elementRef, hasOverflowAtStart, hasOverflowAtEnd };
}

const tabsCSS = css`
  display: flex;
  color: var(--global-text-color-900);
  --tab-border-color: var(--global-border-color-default);

  flex-direction: column;
  height: 100%;

  &[data-orientation="horizontal"] {
    flex: 1 1 auto;
    overflow: hidden;
    box-sizing: border-box;
    .react-aria-TabPanel[data-padded="true"] {
      padding-top: var(--global-dimension-size-200);
    }
  }

  &[data-orientation="vertical"] {
    flex-direction: row;
    .react-aria-TabPanel[data-padded="true"] {
      padding-left: var(--global-dimension-size-200);
    }
  }
`;

export function Tabs({
  children,
  css: _css,
  className,
  orientation = "horizontal",
  ...props
}: AriaTabsProps & StylableProps) {
  return (
    <AriaTabs
      css={css(tabsCSS, _css)}
      className={classNames("react-aria-Tabs", "tabs", className)}
      orientation={orientation}
      {...props}
    >
      {children}
    </AriaTabs>
  );
}

const tabListCSS = css`
  display: flex;

  // The sliding selection indicator. react-aria positions it over the
  // selected tab via translate and animates between tabs; only the
  // orientation-specific appearance is styled here.
  .react-aria-SelectionIndicator {
    position: absolute;
    border-radius: var(--global-rounding-small);
    transition-property: translate, width, height;
    transition-duration: 250ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  &[data-orientation="vertical"] {
    flex-direction: column;

    // Tighter vertical rhythm than the horizontal bar: shorter tabs and a
    // slimmer pill inset so the rail reads as a compact list, not a stack of
    // spaced-out buttons.
    --tab-pill-inset: var(--global-dimension-size-25)
      var(--global-dimension-size-50);
    .react-aria-Tab {
      padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    }

    // The selected tab is marked with a filled pill behind its label (the
    // same treatment as the side nav's active item) rather than an edge bar,
    // which would float detached from the left-aligned labels. The pill is
    // inset to match the hover pill so the two states share a shape.
    .react-aria-SelectionIndicator {
      inset: var(--tab-pill-inset);
      background: var(--global-color-primary-100);
      z-index: -1;
    }
  }

  &[data-orientation="horizontal"] {
    // Draw the bottom border as an inset shadow so it stays pinned to the
    // visible width while tabs scroll beneath it. When the edge fade below is
    // active the line fades along with the rest of that edge — the whole edge
    // dissolves together.
    box-shadow: inset 0 -1px 0 0 var(--tab-border-color);
    // When there are more tabs than horizontal space, scroll rather than
    // wrapping tab labels or clipping tabs off the edge.
    overflow-x: auto;
    // react-aria scrolls the focused tab just into view on keyboard
    // navigation and honors scroll-padding, so inset the scroll port to keep
    // the focused tab from parking underneath the edge fade.
    scroll-padding-inline: var(--tab-fade-size);
    // Settle trackpad/touch scrolls on a tab boundary so the list never rests
    // with a half-clipped tab under the edge fade. Proximity (not mandatory)
    // keeps long free scrolls through many tabs feeling natural.
    scroll-snap-type: x proximity;
    // Hide the scrollbar; the overflow is still scrollable via trackpad,
    // shift-scroll, or keyboard navigation between tabs. A directional fade
    // (below) signals that more tabs are available since macOS hides the
    // scrollbar until the user scrolls.
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }

    // Fade the edge(s) that have tabs hidden beyond them. The fade is
    // transparent-to-opaque so tabs appear to dissolve off the edge, hinting
    // that the list can be scrolled. Each side's fade width collapses to 0
    // when that side has no hidden tabs, and the mask is dropped entirely
    // when everything fits.
    --tab-fade-size: var(--global-dimension-size-400);
    --tab-fade-start: 0px;
    --tab-fade-end: 0px;
    &[data-overflow-start="true"] {
      --tab-fade-start: var(--tab-fade-size);
    }
    &[data-overflow-end="true"] {
      --tab-fade-end: var(--tab-fade-size);
    }
    &:is([data-overflow-start="true"], [data-overflow-end="true"]) {
      mask-image: linear-gradient(
        to right,
        transparent,
        black var(--tab-fade-start),
        black calc(100% - var(--tab-fade-end)),
        transparent
      );
    }

    .react-aria-SelectionIndicator {
      left: 0;
      bottom: 0;
      width: 100%;
      height: 3px;
      background: var(--tab-indicator-color, var(--global-color-primary));
      z-index: 1;
    }

    .react-aria-Tab {
      // Prevent tabs from shrinking or wrapping their labels when the list
      // runs out of room.
      flex: 0 0 auto;
      white-space: nowrap;
      scroll-snap-align: start;
    }
  }
`;

export function TabList<T extends object>({
  children,
  css: _css,
  className,
  ...props
}: AriaTabListProps<T> & StylableProps) {
  const { ref, hasOverflowAtStart, hasOverflowAtEnd } = useHorizontalOverflow();
  return (
    <AriaTabList
      ref={ref}
      css={css(tabListCSS, _css)}
      className={classNames("react-aria-TabList", className)}
      data-overflow-start={hasOverflowAtStart}
      data-overflow-end={hasOverflowAtEnd}
      {...props}
    >
      {children}
    </AriaTabList>
  );
}

const tabPanelCSS = css`
  margin-top: 0;
  padding: 0;
  border-radius: 0;
  outline: none;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  height: 100%;

  &[data-focus-visible] {
    outline: unset;
  }
`;

export function TabPanel({
  css: _css,
  className,
  padded,
  ...props
}: { padded?: boolean } & AriaTabPanelProps & StylableProps) {
  return (
    <AriaTabPanel
      css={css(tabPanelCSS, _css)}
      className={classNames("react-aria-TabPanel", className)}
      data-padded={padded}
      {...props}
    />
  );
}

export function LazyTabPanel({
  children,
  id,
  ...props
}: { children: React.ReactNode } & ComponentProps<typeof TabPanel> &
  StylableProps) {
  return (
    <TabPanel id={id} {...props}>
      {({ state: { selectedKey } }) => (selectedKey === id ? children : null)}
    </TabPanel>
  );
}

const tabCSS = css`
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  cursor: default;
  outline: none;
  position: relative;
  // The hover pill and selection indicator sit at z-index -1; isolate the
  // tab so they paint just behind its label instead of escaping to an outer
  // stacking context and disappearing behind opaque page backgrounds.
  isolation: isolate;
  color: var(--global-text-color-700);
  transition: color 150ms ease-out;
  forced-color-adjust: none;
  -webkit-tap-highlight-color: transparent;
  font-weight: 400;
  line-height: var(--global-line-height-s);
  font-size: var(--global-font-size-s);

  // Hover pill, drawn behind the label and inset from the tab's hit area so
  // adjacent pills never touch. Kept as a pseudo-element so the tab's own box
  // (and the selection indicator's measurements) are unaffected.
  &:before {
    content: "";
    position: absolute;
    inset: var(--tab-pill-inset, var(--global-dimension-size-50));
    border-radius: var(--global-rounding-small);
    transition: background 150ms ease-out;
    z-index: -1;
  }

  @media (prefers-reduced-motion: reduce) {
    &,
    &:before {
      transition: none;
    }
  }

  &[data-hovered],
  &[data-focused],
  &[data-selected] {
    color: var(--global-text-color-900);
  }

  &[data-hovered]:not([data-selected]):before {
    background: var(--global-color-primary-50);
  }

  &[data-disabled] {
    color: var(--global-text-color-300);
    --tab-indicator-color: var(--global-text-color-300);
  }

  &[data-focus-visible]:after {
    content: "";
    position: absolute;
    inset: var(--tab-pill-inset, var(--global-dimension-size-50));
    border-radius: var(--global-rounding-small);
    border: var(--focus-ring-thickness) solid var(--focus-ring-color);
  }
`;

export function Tab({
  children,
  css: _css,
  className,
  ...props
}: { children: React.ReactNode } & AriaTabProps & StylableProps) {
  return (
    <AriaTab
      css={css(tabCSS, _css)}
      className={classNames("react-aria-Tab", className)}
      {...props}
    >
      {children}
      <AriaSelectionIndicator className="react-aria-SelectionIndicator" />
    </AriaTab>
  );
}
