import type { RefObject } from "react";
import { useContext, useEffect, useRef } from "react";
import type {
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
} from "react-resizable-panels";

import { DrawerResizeContext } from "@phoenix/components/core/overlay/DrawerContext";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
import {
  SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS,
  TRACE_TREE_DEFAULT_WIDTH_PIXELS,
  TRACE_TREE_MIN_WIDTH_PIXELS,
  TRACE_TREE_WIDTH_STORAGE_KEY,
} from "@phoenix/constants";
import { usePersistedState } from "@phoenix/hooks";
import type { SizeValue } from "@phoenix/types/sizing";

const MAIN_DETAILS_WIDTH_PERSISTENCE_ID = "details-panel-main-column";

export function getPreferredColumnWidth({
  value,
  defaultWidth,
  minimumWidth,
}: {
  value: unknown;
  defaultWidth: number;
  minimumWidth: number;
}): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(value, minimumWidth)
    : defaultWidth;
}

export function getDetailsPanelDrawerWidth({
  columnWidths,
  separatorWidths,
}: {
  columnWidths: readonly number[];
  separatorWidths: readonly number[];
}): number {
  return [...columnWidths, ...separatorWidths].reduce(
    (totalWidth, width) => totalWidth + width,
    0
  );
}

export function getMainDetailsWidthFromDrawer({
  drawerWidth,
  treeWidth,
}: {
  drawerWidth: number;
  treeWidth: number;
}): number {
  return Math.max(
    SPAN_DETAILS_MIN_WIDTH_PIXELS,
    drawerWidth - treeWidth - TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS
  );
}

export function getTreeDividerDragLayout({
  maximumDrawerWidth,
  minimumMainWidth,
  minimumTreeWidth,
  requestedTreeWidth,
  startDrawerWidth,
  startMainWidth,
  startTreeWidth,
}: {
  maximumDrawerWidth: number;
  minimumMainWidth: number;
  minimumTreeWidth: number;
  requestedTreeWidth: number;
  startDrawerWidth: number;
  startMainWidth: number;
  startTreeWidth: number;
}): { drawerWidth: number; treeWidth: number } {
  const clampedRequestedTreeWidth = Math.max(
    minimumTreeWidth,
    requestedTreeWidth
  );
  const mainColumnShrinkCapacity = Math.max(
    0,
    startMainWidth - minimumMainWidth
  );
  const largestTreeWidthWithoutDrawerGrowth =
    startTreeWidth + mainColumnShrinkCapacity;
  const availableDrawerGrowth = Math.max(
    0,
    maximumDrawerWidth - startDrawerWidth
  );
  const treeWidth = Math.min(
    clampedRequestedTreeWidth,
    largestTreeWidthWithoutDrawerGrowth + availableDrawerGrowth
  );
  const drawerGrowth = Math.max(
    0,
    treeWidth - largestTreeWidthWithoutDrawerGrowth
  );

  return {
    drawerWidth: startDrawerWidth + drawerGrowth,
    treeWidth,
  };
}

export function useDetailsPanelSizing(): {
  defaultDrawerSize: SizeValue;
  onDrawerSizeChange: (sizePercent: number, sizePixels: number) => void;
  onPreferredTreeWidthChange: (width: number) => void;
  preferredTreeWidth: number;
} {
  const [storedTreeWidth, setStoredTreeWidth] = usePersistedState<unknown>(
    TRACE_TREE_WIDTH_STORAGE_KEY,
    TRACE_TREE_DEFAULT_WIDTH_PIXELS
  );
  const preferredTreeWidth = getPreferredColumnWidth({
    value: storedTreeWidth,
    defaultWidth: TRACE_TREE_DEFAULT_WIDTH_PIXELS,
    minimumWidth: TRACE_TREE_MIN_WIDTH_PIXELS,
  });
  const {
    defaultSize: storedMainDetailsWidth,
    onSizeChange: persistMainDetailsWidth,
  } = useDefaultDrawerSize({
    id: MAIN_DETAILS_WIDTH_PERSISTENCE_ID,
    defaultSize: SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
    minimumSize: SPAN_DETAILS_MIN_WIDTH_PIXELS,
    persistenceUnit: "pixels",
  });
  const preferredMainDetailsWidth = getPreferredColumnWidth({
    value: storedMainDetailsWidth,
    defaultWidth: SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
    minimumWidth: SPAN_DETAILS_MIN_WIDTH_PIXELS,
  });
  const defaultDrawerSize = getDetailsPanelDrawerWidth({
    columnWidths: [preferredTreeWidth, preferredMainDetailsWidth],
    separatorWidths: [TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS],
  });

  const onDrawerSizeChange = (_sizePercent: number, sizePixels: number) => {
    const mainDetailsWidth = getMainDetailsWidthFromDrawer({
      drawerWidth: sizePixels,
      treeWidth: preferredTreeWidth,
    });
    persistMainDetailsWidth(
      (mainDetailsWidth / window.innerWidth) * 100,
      mainDetailsWidth
    );
  };

  const onPreferredTreeWidthChange = (width: number) => {
    setStoredTreeWidth(width);
  };

  return {
    defaultDrawerSize,
    onDrawerSizeChange,
    onPreferredTreeWidthChange,
    preferredTreeWidth,
  };
}

export function usePreferredTreePanel({
  preferredTreeWidth,
  onPreferredTreeWidthChange,
}: {
  preferredTreeWidth: number;
  onPreferredTreeWidthChange: (width: number) => void;
}): {
  groupElementRef: RefObject<HTMLDivElement | null>;
  onTreeResize: (width: number) => number;
  onTreeResizeEnd: (options: {
    didMove: boolean;
    shouldCommit: boolean;
  }) => void;
  onTreeResizeStart: (width: number) => void;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
  treePanelRef: RefObject<PanelImperativeHandle | null>;
} {
  const drawerResizeController = useContext(DrawerResizeContext);
  const groupElementRef = useRef<HTMLDivElement>(null);
  const treePanelRef = useRef<PanelImperativeHandle>(null);
  const isTreeResizingRef = useRef(false);
  const treeResizeSessionRef = useRef(0);
  const pendingTreeResizeFrameRef = useRef<number | null>(null);
  const treeResizeStateRef = useRef<{
    maximumDrawerWidth: number;
    startDrawerWidth: number;
    startMainWidth: number;
    startTreeWidth: number;
  } | null>(null);
  const latestTreeResizeLayoutRef = useRef<{
    drawerWidth: number;
    treeWidth: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTreeResizeFrameRef.current != null) {
        cancelAnimationFrame(pendingTreeResizeFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const groupElement = groupElementRef.current;
    if (!groupElement) return undefined;

    const reclaimPreferredTreeWidth = () => {
      if (isTreeResizingRef.current) {
        const activeTreeWidth = latestTreeResizeLayoutRef.current?.treeWidth;
        if (activeTreeWidth != null) {
          treePanelRef.current?.resize(activeTreeWidth);
        }
        return;
      }
      const availableTreeWidth =
        groupElement.getBoundingClientRect().width -
        TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS -
        SPAN_DETAILS_MIN_WIDTH_PIXELS;
      treePanelRef.current?.resize(
        Math.max(
          TRACE_TREE_MIN_WIDTH_PIXELS,
          Math.min(preferredTreeWidth, availableTreeWidth)
        )
      );
    };
    let animationFrameId: number | null = null;
    const schedulePreferredTreeWidthReclamation = () => {
      if (animationFrameId != null) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        reclaimPreferredTreeWidth();
      });
    };
    const resizeObserver = new ResizeObserver(
      schedulePreferredTreeWidthReclamation
    );
    resizeObserver.observe(groupElement);
    schedulePreferredTreeWidthReclamation();
    return () => {
      resizeObserver.disconnect();
      if (animationFrameId != null) cancelAnimationFrame(animationFrameId);
    };
  }, [preferredTreeWidth]);

  const onLayoutChanged = (
    _layout: Layout,
    { isUserInteraction }: LayoutChangedMeta
  ) => {
    const treePanel = treePanelRef.current;
    if (!treePanel) return;

    if (isTreeResizingRef.current) return;

    if (isUserInteraction) {
      onPreferredTreeWidthChange(treePanel.getSize().inPixels);
      return;
    }

    // Parent drawer and viewport resizes may temporarily force the tree below
    // its preference. Re-request it whenever room returns without persisting
    // the constrained effective width.
    treePanel.resize(preferredTreeWidth);
  };

  const applyTreeResizeLayout = (layout: {
    drawerWidth: number;
    treeWidth: number;
  }) => {
    latestTreeResizeLayoutRef.current = layout;
    drawerResizeController?.resizeToPixels(layout.drawerWidth);

    const treePanel = treePanelRef.current;
    if (!treePanel) return;
    treePanel.resize(layout.treeWidth);

    // Growing the drawer commits through React state. Retry the panel resize
    // after that wider group has been laid out; the immediate call above still
    // handles the fixed-drawer portion of the same gesture without a frame of
    // lag.
    if (treePanel.getSize().inPixels !== layout.treeWidth) {
      if (pendingTreeResizeFrameRef.current != null) {
        cancelAnimationFrame(pendingTreeResizeFrameRef.current);
      }
      pendingTreeResizeFrameRef.current = requestAnimationFrame(() => {
        pendingTreeResizeFrameRef.current = null;
        treePanelRef.current?.resize(layout.treeWidth);
      });
    }
  };

  const getTreeResizeLayout = (requestedTreeWidth: number) => {
    const resizeState = treeResizeStateRef.current;
    if (!resizeState) {
      return {
        drawerWidth:
          drawerResizeController?.getSizePixels() ??
          groupElementRef.current?.getBoundingClientRect().width ??
          0,
        treeWidth: preferredTreeWidth,
      };
    }
    return getTreeDividerDragLayout({
      ...resizeState,
      minimumMainWidth: SPAN_DETAILS_MIN_WIDTH_PIXELS,
      minimumTreeWidth: TRACE_TREE_MIN_WIDTH_PIXELS,
      requestedTreeWidth,
    });
  };

  const onTreeResize = (requestedTreeWidth: number) => {
    const layout = getTreeResizeLayout(requestedTreeWidth);
    applyTreeResizeLayout(layout);
    return layout.treeWidth;
  };

  const onTreeResizeStart = (renderedTreeWidth: number) => {
    const groupWidth =
      groupElementRef.current?.getBoundingClientRect().width ?? 0;
    const startTreeWidth =
      treePanelRef.current?.getSize().inPixels ?? preferredTreeWidth;
    const startDrawerWidth =
      drawerResizeController?.getSizePixels() ?? groupWidth;
    treeResizeSessionRef.current += 1;
    isTreeResizingRef.current = true;
    treeResizeStateRef.current = {
      maximumDrawerWidth:
        drawerResizeController?.getMaximumSizePixels() ?? startDrawerWidth,
      startDrawerWidth,
      startMainWidth: Math.max(
        SPAN_DETAILS_MIN_WIDTH_PIXELS,
        groupWidth - startTreeWidth - TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS
      ),
      startTreeWidth,
    };
    onTreeResize(renderedTreeWidth);
  };

  const onTreeResizeEnd = ({
    didMove,
    shouldCommit,
  }: {
    didMove: boolean;
    shouldCommit: boolean;
  }) => {
    const resizeSession = treeResizeSessionRef.current;
    const resizeState = treeResizeStateRef.current;
    const releasedLayout = latestTreeResizeLayoutRef.current;
    const didResize =
      shouldCommit &&
      didMove &&
      resizeState != null &&
      releasedLayout != null &&
      releasedLayout.treeWidth !== resizeState.startTreeWidth;

    if (didResize && releasedLayout) {
      onPreferredTreeWidthChange(releasedLayout.treeWidth);
    } else if (resizeState) {
      applyTreeResizeLayout({
        drawerWidth: resizeState.startDrawerWidth,
        treeWidth: resizeState.startTreeWidth,
      });
    }
    requestAnimationFrame(() => {
      if (treeResizeSessionRef.current === resizeSession) {
        isTreeResizingRef.current = false;
        treeResizeStateRef.current = null;
        latestTreeResizeLayoutRef.current = null;
      }
    });
  };

  return {
    groupElementRef,
    onLayoutChanged,
    onTreeResize,
    onTreeResizeEnd,
    onTreeResizeStart,
    treePanelRef,
  };
}
