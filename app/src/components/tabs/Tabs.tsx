import React, { ComponentProps } from "react";
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
import { css } from "@emotion/react";

import { StylableProps } from "@phoenix/components/types";
import { classNames } from "@phoenix/utils";

const tabsCSS = css`
  display: flex;
  color: var(--ac-global-text-color-900);
  --ac-tab-border-color: var(--ac-global-border-color-default);

  flex-direction: column;
  height: 100%;

  &[data-orientation="horizontal"] {
    flex: 1 1 auto;
    overflow: hidden;
    box-sizing: border-box;
    .react-aria-TabPanel[data-padded="true"] {
      padding-top: var(--ac-global-dimension-static-size-200);
    }
  }

  &[data-orientation="vertical"] {
    flex-direction: row;
    .react-aria-TabPanel[data-padded="true"] {
      padding-left: var(--ac-global-dimension-static-size-200);
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
      className={classNames("react-aria-Tabs", "ac-tabs", className)}
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
    border-inline-end: 1px solid var(--ac-tab-border-color);

    .react-aria-Tab {
      border-inline-end: 3px solid var(--ac-tab-border-color, transparent);
    }
  }

  &[data-orientation="horizontal"] {
    border-bottom: 1px solid var(--ac-tab-border-color);

    .react-aria-Tab {
      border-bottom: 3px solid var(--ac-tab-border-color);
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
  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-200);
  cursor: default;
  outline: none;
  position: relative;
  color: var(--ac-global-text-color-700);
  transition: color 200ms;
  --ac-tab-border-color: transparent;
  forced-color-adjust: none;
  font-weight: 600;
  line-height: var(--ac-global-line-height-s);
  font-size: var(--ac-global-font-size-s);

  &[data-hovered],
  &[data-focused] {
    --ac-tab-border-color: var(--ac-global-color-primary-300);
  }

  &[data-selected] {
    --ac-tab-border-color: var(--ac-global-color-primary);
    color: var(--ac-global-text-color-900);
  }

  &[data-disabled] {
    color: var(--ac-global-text-color-300);
    &[data-selected] {
      --ac-tab-border-color: var(--ac-global-text-color-300);
    }
  }

  &[data-focus-visible]:after {
    content: "";
    position: absolute;
    inset: var(--ac-global-dimension-size-50);
    border-radius: var(--ac-global-rounding-small);
    border: 2px solid var(--ac-focus-ring-color);
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
