import { css } from "@emotion/react";
import type { Key, PropsWithChildren, ReactNode } from "react";
import {
  createContext,
  Suspense,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Group, Panel } from "react-resizable-panels";

import {
  DialogCloseButton,
  ErrorBoundary,
  Icon,
  Icons,
} from "@phoenix/components";
import { BugReportErrorBoundaryFallback } from "@phoenix/components/exception/BugReportErrorBoundaryFallback";
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

import { DetailsPanelInteractionScope } from "./DetailsPanelInteractionScope";
import { usePreferredTreePanel } from "./useDetailsPanelSizing";

const detailsPanelCSS = css`
  flex: 1 1 auto;
  overflow: hidden;
`;

const detailsPanelSlotHostCSS = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const detailsPanelNavigationSlotHostCSS = css`
  ${detailsPanelSlotHostCSS}
  overflow: visible;
`;

type DetailsPanelPortalTargets = {
  main: HTMLDivElement;
  navigation: HTMLDivElement;
};

type DetailsPanelPortalController = {
  register: (targets: DetailsPanelPortalTargets) => () => void;
};

const DetailsPanelPortalContext =
  createContext<DetailsPanelPortalController | null>(null);

function createDetailsPanelPortalTarget({
  className,
  overflow,
}: {
  className: string;
  overflow: "hidden" | "visible";
}): HTMLDivElement {
  const target = document.createElement("div");
  target.className = className;
  target.style.display = "flex";
  target.style.flexDirection = "column";
  target.style.width = "100%";
  target.style.height = "100%";
  target.style.overflow = overflow;
  return target;
}

/**
 * Projects navigation and main content into a permanently mounted
 * {@link DetailsPanel}. Loading, error, and resolved states must swap this
 * content rather than replacing the resizable panel group itself.
 */
export function DetailsPanelContent({
  children,
  navigation,
}: PropsWithChildren<{ navigation: ReactNode }>) {
  const controller = useContext(DetailsPanelPortalContext);
  const [targets] = useState<DetailsPanelPortalTargets>(() => ({
    main: createDetailsPanelPortalTarget({
      className: "details-panel-main-content",
      overflow: "hidden",
    }),
    navigation: createDetailsPanelPortalTarget({
      className: "details-panel-navigation-content",
      overflow: "visible",
    }),
  }));
  useLayoutEffect(() => controller?.register(targets), [controller, targets]);

  if (controller == null) {
    throw new Error("DetailsPanelContent must be rendered inside DetailsPanel");
  }

  return (
    <>
      {createPortal(navigation, targets.navigation)}
      {createPortal(children, targets.main)}
    </>
  );
}

export function DetailsPanelErrorContent({
  error,
  navigation,
}: {
  error?: string | null;
  navigation: ReactNode;
}) {
  return (
    <DetailsPanelContent navigation={navigation}>
      <BugReportErrorBoundaryFallback error={error} />
    </DetailsPanelContent>
  );
}

/**
 * Owns the loading and error lifecycle for one details-panel subject while the
 * surrounding column state machine remains mounted. A subject change must
 * reset this boundary so React cannot retain the previous subject's portal
 * content while the next Relay query suspends.
 */
export function DetailsPanelContentBoundary({
  children,
  fallback,
  navigation,
  subjectKey,
}: PropsWithChildren<{
  fallback: ReactNode;
  navigation: ReactNode;
  subjectKey: Key;
}>) {
  return (
    <ErrorBoundary
      key={subjectKey}
      fallback={({ error }) => (
        <DetailsPanelErrorContent error={error} navigation={navigation} />
      )}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

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

const detailsPanelMainColumnCSS = css`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
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
  navigationAriaLabel,
  onPreferredTreeWidthChange,
  preferredTreeWidth,
  treeAddonWidth,
  treeMaximumWidth,
}: {
  children: ReactNode;
  dataTestId?: string;
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

  const navigationHostRef = useRef<HTMLDivElement>(null);
  const mainHostRef = useRef<HTMLDivElement>(null);
  const registrationsRef = useRef<DetailsPanelPortalTargets[]>([]);
  const synchronizePortalHosts = () => {
    const navigationHost = navigationHostRef.current;
    const mainHost = mainHostRef.current;
    if (navigationHost == null || mainHost == null) return;
    const activeTargets = registrationsRef.current.at(-1);
    if (activeTargets == null) {
      navigationHost.replaceChildren();
      mainHost.replaceChildren();
      return;
    }
    navigationHost.replaceChildren(activeTargets.navigation);
    mainHost.replaceChildren(activeTargets.main);
  };
  const portalControllerRef = useRef<DetailsPanelPortalController>(null);
  if (portalControllerRef.current == null) {
    portalControllerRef.current = {
      register: (targets) => {
        registrationsRef.current.push(targets);
        synchronizePortalHosts();
        return () => {
          const registrationIndex = registrationsRef.current.indexOf(targets);
          if (registrationIndex >= 0) {
            registrationsRef.current.splice(registrationIndex, 1);
          }
          synchronizePortalHosts();
        };
      },
    };
  }

  return (
    <DetailsPanelInteractionScope rootRef={groupElementRef}>
      <DetailsPanelPortalContext.Provider value={portalControllerRef.current}>
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
              <div
                ref={navigationHostRef}
                css={detailsPanelNavigationSlotHostCSS}
              />
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
            css={detailsPanelMainColumnCSS}
          >
            <div
              ref={mainHostRef}
              css={detailsPanelSlotHostCSS}
              style={{ flex: "1 1 auto", minHeight: 0 }}
            />
          </Panel>
        </Group>
        {children}
      </DetailsPanelPortalContext.Provider>
    </DetailsPanelInteractionScope>
  );
}
