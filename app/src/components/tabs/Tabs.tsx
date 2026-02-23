import { css } from "@emotion/react";
import type { ComponentProps } from "react";
import React from "react";
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

import type { StylableProps } from "@phoenix/components/types";
import { classNames } from "@phoenix/utils";

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
    border-bottom: 1px solid var(--tab-border-color);

    .react-aria-Tab {
      border-bottom: 3px solid var(--tab-border-color);
    }
  }
`;

export function TabList<T extends object>({
  children,
  css: _css,
  className,
  ...props
}: AriaTabListProps<T> & StylableProps) {
  return (
    <AriaTabList
      css={css(tabListCSS, _css)}
      className={classNames("react-aria-TabList", className)}
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
