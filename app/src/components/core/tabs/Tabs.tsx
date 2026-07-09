import { css } from "@emotion/react";
import type { ComponentProps } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
 * Tracks whether a horizontally scrollable element has content hidden beyond
 * its start and/or end edges. Used to render a directional fade affordance on
 * the tab bar, since the scrollbar is hidden and macOS does not show one until
 * the user actively scrolls.
 *
 * Returns a callback ref to attach to the scroll container plus booleans for
 * whether content overflows past the start (left) and end (right) edges.
 */
function useHorizontalOverflow() {
  const elementRef = useRef<HTMLElement | null>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = elementRef.current;
    if (!el) {
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Account for sub-pixel rounding so the fade doesn't linger at the ends.
    const maxScroll = scrollWidth - clientWidth;
    const start = scrollLeft > 1;
    const end = scrollLeft < maxScroll - 1;
    setOverflow((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end }
    );
  }, []);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      elementRef.current = node;
      update();
    },
    [update]
  );

  useEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return;
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [update]);

  return { ref, overflow };
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
      padding-top: var(--global-dimension-static-size-200);
    }
  }

  &[data-orientation="vertical"] {
    flex-direction: row;
    .react-aria-TabPanel[data-padded="true"] {
      padding-left: var(--global-dimension-static-size-200);
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

  &[data-orientation="vertical"] {
    flex-direction: column;
    border-inline-end: 1px solid var(--tab-border-color);

    .react-aria-Tab {
      border-inline-end: 3px solid var(--tab-border-color, transparent);
    }
  }

  &[data-orientation="horizontal"] {
    // Keep the bottom border spanning the full width even when the tabs
    // overflow and the list becomes horizontally scrollable.
    box-shadow: inset 0 -1px 0 0 var(--tab-border-color);
    // When there are more tabs than horizontal space, scroll rather than
    // wrapping tab labels or clipping tabs off the edge.
    overflow-x: auto;
    // Hide the scrollbar; the overflow is still scrollable via trackpad,
    // shift-scroll, or keyboard navigation between tabs. A directional fade
    // (below) signals that more tabs are available since macOS hides the
    // scrollbar until the user scrolls.
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }

    // Fade the edge(s) that have tabs hidden beyond them. The fade width is
    // transparent-to-opaque so tabs appear to dissolve off the edge, hinting
    // that the list can be scrolled. Only the overflowing side is faded, so
    // there is no fade when everything fits or when scrolled to an end.
    --tab-fade-size: var(--global-dimension-static-size-400);
    &[data-overflow-start="true"][data-overflow-end="true"] {
      mask-image: linear-gradient(
        to right,
        transparent,
        black var(--tab-fade-size),
        black calc(100% - var(--tab-fade-size)),
        transparent
      );
    }
    &[data-overflow-start="true"][data-overflow-end="false"] {
      mask-image: linear-gradient(
        to right,
        transparent,
        black var(--tab-fade-size)
      );
    }
    &[data-overflow-start="false"][data-overflow-end="true"] {
      mask-image: linear-gradient(
        to right,
        black calc(100% - var(--tab-fade-size)),
        transparent
      );
    }

    .react-aria-Tab {
      border-bottom: 3px solid var(--tab-border-color);
      // Prevent tabs from shrinking or wrapping their labels when the list
      // runs out of room.
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }
`;

export function TabList<T extends object>({
  children,
  css: _css,
  className,
  ...props
}: AriaTabListProps<T> & StylableProps) {
  const { ref, overflow } = useHorizontalOverflow();
  return (
    <AriaTabList
      ref={ref}
      css={css(tabListCSS, _css)}
      className={classNames("react-aria-TabList", className)}
      data-overflow-start={overflow.start}
      data-overflow-end={overflow.end}
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
  padding: var(--global-dimension-static-size-100)
    var(--global-dimension-static-size-200);
  cursor: default;
  outline: none;
  position: relative;
  color: var(--global-text-color-700);
  transition: color 200ms;
  --tab-border-color: transparent;
  forced-color-adjust: none;
  font-weight: 600;
  line-height: var(--global-line-height-s);
  font-size: var(--global-font-size-s);

  &[data-hovered],
  &[data-focused] {
    --tab-border-color: var(--global-color-primary-300);
  }

  &[data-selected] {
    --tab-border-color: var(--global-color-primary);
    color: var(--global-text-color-900);
  }

  &[data-disabled] {
    color: var(--global-text-color-300);
    &[data-selected] {
      --tab-border-color: var(--global-text-color-300);
    }
  }

  &[data-focus-visible]:after {
    content: "";
    position: absolute;
    inset: var(--global-dimension-size-50);
    border-radius: var(--global-rounding-small);
    border: 2px solid var(--focus-ring-color);
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
    </AriaTab>
  );
}
