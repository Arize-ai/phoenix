import { css } from "@emotion/react";
import type { ReactNode } from "react";
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
`;

const detailsPanelHeaderCSS = css`
  box-sizing: border-box;
  display: grid;
  grid-template-areas: "close pagination title collapse";
  grid-template-columns: auto auto minmax(0, 1fr) auto;
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

  .details-panel-header__pagination {
    grid-area: pagination;
  }

  .details-panel-header__title {
    grid-area: title;
    min-width: 0;
  }

  .details-panel-header__collapse-button {
    grid-area: collapse;
  }

  @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
    grid-template-areas:
      "close"
      "collapse"
      "pagination";
    grid-template-columns: 1fr;
    justify-items: start;

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
      <DialogCloseButton
        className="details-panel-header__close-button"
        close={close}
        variant="quiet"
        aria-label={closeLabel}
        leadingVisual={<Icon svg={<Icons.Close />} />}
      />
      {pagination ? (
        <div className="details-panel-header__pagination">{pagination}</div>
      ) : null}
      {title ? (
        <div className="details-panel-header__title">{title}</div>
      ) : null}
      <TraceTreePanelToggleButton
        className="details-panel-header__collapse-button"
        isCollapsed={isCollapsed}
        onCollapsedChange={onCollapsedChange}
      />
    </header>
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
        <ResizableTraceTreePanelContent>
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
