import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { Group, Panel } from "react-resizable-panels";

import { DialogCloseButton, Icon, Icons } from "@phoenix/components";
import {
  ResizableTraceTreePanelContent,
  ResizableTraceTreeSeparator,
  resizableTraceTreePanelStyle,
} from "@phoenix/components/trace/ResizableTraceTreePanelContent";
import { TraceTreePanelToggleButton } from "@phoenix/components/trace/TraceTreePanelToggleButton";
import {
  SPAN_DETAILS_MAX_WIDTH_PIXELS,
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS,
} from "@phoenix/constants";

import { usePreferredTreePanel } from "./useDetailsPanelSizing";

const detailsPanelCSS = css`
  flex: 1 1 auto;
  overflow: hidden;
`;

const detailsPanelNavigationCSS = css`
  container-name: trace-tree-panel;
  container-type: inline-size;
  z-index: var(--global-z-index-local-overlay);

  &:has(.trace-tree-navigation__overlay[data-open="true"]),
  &:has(.session-details-navigation__content[data-open="true"]) {
    z-index: calc(var(--global-z-index-local-control) + 1);
  }

  &:has(+ .details-panel-tree-separator[data-dragging="true"])
    .trace-tree-navigation__overlay,
  &:has(+ .details-panel-tree-separator[data-dragging="true"])
    .session-details-navigation__content[data-open="true"] {
    visibility: hidden;
    pointer-events: none;
  }
`;

const detailsPanelHeaderCSS = css`
  box-sizing: border-box;
  display: grid;
  grid-template-areas: "close pagination title";
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: var(--global-dimension-size-100);
  width: 100%;
  padding: var(--global-dimension-size-100);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  flex: none;

  .details-panel-header__close-button {
    grid-area: close;
  }

  .details-panel-header__close-row {
    display: contents;
  }

  .details-panel-header__pagination {
    grid-area: pagination;
  }

  .details-panel-header__title {
    grid-area: title;
    min-width: 0;
  }

  .details-panel-header__compact-collapse-button {
    display: none;
  }

  @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
    grid-template-areas:
      "close-row"
      "collapse"
      "pagination";
    grid-template-columns: 1fr;
    gap: 0;
    padding: 0;
    justify-items: start;

    .details-panel-header__close-row {
      box-sizing: border-box;
      display: flex;
      grid-area: close-row;
      width: 100%;
      padding: var(--global-dimension-size-100);
      border-bottom: var(--global-border-size-thin) solid
        var(--global-border-color-default);
    }

    .details-panel-header__compact-collapse-button {
      display: inline-flex;
      grid-area: collapse;
      margin: var(--global-dimension-size-100);
    }

    .details-panel-header__pagination {
      margin: 0 var(--global-dimension-size-100)
        var(--global-dimension-size-100);
    }

    .details-panel-header__title {
      display: none;
    }

    .trace-details-paginator__buttons,
    .session-details-paginator__buttons {
      flex-direction: column;
    }
  }
`;

export function DetailsPanelHeader({
  close,
  closeLabel,
  isCollapsed,
  onCollapsedChange,
  pagination,
  title,
}: {
  close: () => void;
  closeLabel: string;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  pagination?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <header className="details-panel-header" css={detailsPanelHeaderCSS}>
      <div className="details-panel-header__close-row">
        <DialogCloseButton
          className="details-panel-header__close-button"
          close={close}
          variant="quiet"
          aria-label={closeLabel}
          leadingVisual={<Icon svg={<Icons.Close />} />}
        />
      </div>
      <TraceTreePanelToggleButton
        className="details-panel-header__compact-collapse-button"
        isCollapsed={isCollapsed}
        onCollapsedChange={onCollapsedChange}
      />
      {pagination ? (
        <div className="details-panel-header__pagination">{pagination}</div>
      ) : null}
      {title ? (
        <div className="details-panel-header__title">{title}</div>
      ) : null}
    </header>
  );
}

const detailsPanelNavigationControlsRowCSS = css`
  box-sizing: border-box;
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: var(--global-dimension-size-100);
  width: 100%;
  padding: var(--global-dimension-size-100);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
    display: none;
  }
`;

export function DetailsPanelNavigationControlsRow({
  children,
  isCollapsed,
  onCollapsedChange,
}: PropsWithChildren<{
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
}>) {
  return (
    <div
      className="details-panel-navigation-controls"
      css={detailsPanelNavigationControlsRowCSS}
    >
      {children}
      <TraceTreePanelToggleButton
        isCollapsed={isCollapsed}
        onCollapsedChange={onCollapsedChange}
      />
    </div>
  );
}

export function DetailsPanel({
  children,
  dataTestId,
  navigation,
  navigationAriaLabel,
  onPreferredTreeWidthChange,
  preferredTreeWidth,
  treeAddonWidth,
  treeMaximumWidth,
}: {
  children: ReactNode;
  dataTestId?: string;
  navigation: ReactNode;
  navigationAriaLabel?: string;
  onPreferredTreeWidthChange: (width: number) => void;
  preferredTreeWidth: number;
  treeAddonWidth?: number;
  treeMaximumWidth: number;
}) {
  const {
    defaultTreeWidth,
    groupElementRef,
    isTreeCollapsed,
    isTreeSeparatorDisabled,
    maximumTreeWidth,
    minimumTreeWidth,
    onLayoutChanged,
    onTreeResize,
    onTreeResizeEnd,
    onTreeResizeStart,
    onTreeToggle,
    treeOverlayWidth,
    treePanelRef,
  } = usePreferredTreePanel({
    preferredTreeWidth,
    onPreferredTreeWidthChange,
    treeAddonWidth,
    treeMaximumWidth,
  });

  return (
    <Group
      data-testid={dataTestId}
      elementRef={groupElementRef}
      orientation="horizontal"
      onLayoutChanged={onLayoutChanged}
      className="details-panel-columns"
      css={detailsPanelCSS}
    >
      <Panel
        id="details-panel-tree-column"
        panelRef={treePanelRef}
        defaultSize={defaultTreeWidth}
        minSize={minimumTreeWidth}
        maxSize={maximumTreeWidth}
        groupResizeBehavior="preserve-pixel-size"
        css={detailsPanelNavigationCSS}
        style={resizableTraceTreePanelStyle}
      >
        <ResizableTraceTreePanelContent
          expandedWidth={treeOverlayWidth}
          isCollapsed={isTreeCollapsed}
        >
          {navigation}
        </ResizableTraceTreePanelContent>
      </Panel>
      <ResizableTraceTreeSeparator
        ariaLabel={
          isTreeCollapsed ? "Resize main detail view" : navigationAriaLabel
        }
        isCompact={isTreeCollapsed}
        isDisabled={isTreeSeparatorDisabled}
        onResize={onTreeResize}
        onResizeEnd={onTreeResizeEnd}
        onResizeStart={onTreeResizeStart}
        onToggle={onTreeToggle}
      />
      <Panel
        id="details-panel-main-column"
        minSize={SPAN_DETAILS_MIN_WIDTH_PIXELS}
        maxSize={SPAN_DETAILS_MAX_WIDTH_PIXELS}
      >
        {children}
      </Panel>
    </Group>
  );
}
