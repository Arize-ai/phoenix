import { css } from "@emotion/react";
import type { PropsWithChildren, Ref } from "react";
import React, { useId, useImperativeHandle, useRef, useState } from "react";
import type {
  PanelImperativeHandle,
  PanelProps,
  SeparatorProps,
} from "react-resizable-panels";
import { Panel, Separator } from "react-resizable-panels";

import { DisclosureArrow } from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";

/**
 * A panel with a title that can be collapsed and expanded.
 *
 * Add `resizable` prop to make the panel resizable with an automatically added handle.
 * The first TitledPanel in a Group SHOULD NOT be resizable or things will break.
 */
export function TitledPanel({
  ref,
  children,
  title,
  extra,
  panelProps,
  panelResizeHandleProps,
  resizable = false,
  bordered = true,
  disabled,
  headingLevel,
  onCollapseChange,
}: PropsWithChildren<{
  title: React.ReactNode;
  /**
   * Interactive controls rendered on the right side of the title bar.
   * Rendered outside the collapse trigger so they stay usable while collapsed.
   */
  extra?: React.ReactNode;
  panelProps?: Omit<PanelProps, "onResize">;
  panelResizeHandleProps?: SeparatorProps;
  resizable?: boolean;
  bordered?: boolean;
  disabled?: boolean;
  /**
   * When set, the title participates in the page's heading outline at this level
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  onCollapseChange?: (collapsed: boolean) => void;
  ref?: Ref<PanelImperativeHandle | null>;
}>) {
  const panelRef = useRef<PanelImperativeHandle | null>(null);
  useImperativeHandle<
    PanelImperativeHandle | null,
    PanelImperativeHandle | null
  >(ref, () => panelRef.current);
  const [collapsed, setCollapsed] = useState(false);
  // onResize can fire multiple times before React re-renders, so track the
  // latest collapsed value in a ref to avoid stale comparisons
  const collapsedRef = useRef(false);
  const fallbackPanelId = useId();
  // Panel renders its id prop as the DOM id, so the title can point at it
  const panelId = panelProps?.id != null ? `${panelProps.id}` : fallbackPanelId;

  const handleClick = () => {
    const panel = panelRef.current;
    if (panel?.isCollapsed()) {
      panel?.expand();
    } else {
      panel?.collapse();
    }
  };

  return (
    <>
      {resizable && (
        <Separator
          {...panelResizeHandleProps}
          data-bordered={bordered}
          css={css(
            compactResizeHandleCSS,
            css`
              border-radius: var(--global-rounding-small);
              opacity: 1;
              background-color: unset;
              &[data-bordered="true"] {
                background-color: var(--global-border-color-default);
              }
              &[aria-orientation="horizontal"] {
                height: 1px;
              }
              &:hover,
              &:focus,
              &:active,
              &:focus-visible {
                // Make hover target bigger
                background-color: var(--global-color-primary);
              }
            `
          )}
        />
      )}
      <PanelTitle
        onClick={handleClick}
        collapsed={collapsed}
        bordered={bordered}
        disabled={disabled}
        extra={extra}
        headingLevel={headingLevel}
        aria-controls={panelId}
      >
        {title}
      </PanelTitle>
      <Panel
        maxSize="100%"
        {...panelProps}
        id={panelId}
        panelRef={panelRef}
        collapsible
        // keep the 0-height collapsed content out of the tab order and
        // accessibility tree
        inert={collapsed || undefined}
        onResize={(panelSize) => {
          // ask the panel itself rather than testing for 0% — a panel with a
          // non-zero collapsedSize is collapsed at a non-zero percentage, and
          // handleClick already branches on isCollapsed()
          const isCollapsed =
            panelRef.current?.isCollapsed() ?? panelSize.asPercentage === 0;
          if (isCollapsed !== collapsedRef.current) {
            collapsedRef.current = isCollapsed;
            setCollapsed(isCollapsed);
            onCollapseChange?.(isCollapsed);
          }
        }}
      >
        {children}
      </Panel>
    </>
  );
}

TitledPanel.displayName = "TitledPanel";

const panelHeaderCSS = css`
  display: flex;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
  /* locked to the table header row height (border included) so panel headers
     line up with the table they sit beside */
  height: var(--global-table-header-height);
  gap: var(--global-dimension-size-100);
  &[data-bordered="true"] {
    border-bottom: 1px solid var(--global-border-color-default);
  }
  &[data-collapsed="true"] {
    border-bottom-color: transparent;
  }
  transition: background-color 0.2s ease-in-out;
  /* highlight the whole strip when the collapse trigger is hovered so the
     hover state doesn't cut off at the extra cluster */
  &:has(.panel-title__button:hover:not([disabled])) {
    background-color: var(--global-card-header-background-color-hover);
  }
`;

const panelTitleCSS = css`
  all: unset;
  flex: 1 1 auto;
  min-width: 0;
  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
  &:hover {
    cursor: pointer;
  }
  &:hover[disabled] {
    cursor: default;
  }
  &[disabled] {
    opacity: var(--global-opacity-disabled);
  }
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: 0 var(--global-dimension-size-100);
  font-weight: var(--font-weight-heavy);
  font-size: var(--global-font-size-s);
`;

const panelTitleExtraCSS = css`
  /* the enclosing Group clips overflow, so the cluster must be able to shrink
     and scroll rather than have its right-most controls cut off */
  flex: 0 1 auto;
  min-width: 0;
  overflow-x: auto;
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  /* right padding matches the page header's size-200 inset so the extra
     clusters align vertically across the page */
  padding-right: var(--global-dimension-size-200);
  padding-left: var(--global-dimension-size-50);
`;

const panelTitleHeadingCSS = css`
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
`;

export const PanelTitle = ({
  children,
  collapsed,
  bordered,
  disabled,
  extra,
  headingLevel,
  className,
  ...props
}: {
  children: React.ReactNode;
  collapsed?: boolean;
  bordered?: boolean;
  disabled?: boolean;
  extra?: React.ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
} & React.HTMLProps<HTMLButtonElement>) => {
  const button = (
    <button
      {...props}
      type="button"
      className={["panel-title__button", className].filter(Boolean).join(" ")}
      aria-expanded={collapsed === undefined ? undefined : !collapsed}
      data-collapsed={collapsed}
      css={panelTitleCSS}
      disabled={collapsed === undefined || disabled}
    >
      {collapsed !== undefined && <DisclosureArrow isExpanded={!collapsed} />}
      {children}
    </button>
  );
  const HeadingTag =
    headingLevel != null ? (`h${headingLevel}` as const) : null;
  return (
    <div
      data-collapsed={collapsed}
      data-bordered={bordered}
      css={panelHeaderCSS}
    >
      {HeadingTag != null ? (
        <HeadingTag css={panelTitleHeadingCSS}>{button}</HeadingTag>
      ) : (
        button
      )}
      {extra != null && <div css={panelTitleExtraCSS}>{extra}</div>}
    </div>
  );
};
