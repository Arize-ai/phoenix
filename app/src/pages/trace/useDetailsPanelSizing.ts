import type { RefObject } from "react";
import { useRef } from "react";
import type {
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
} from "react-resizable-panels";

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
  treeWidth,
  mainDetailsWidth,
}: {
  treeWidth: number;
  mainDetailsWidth: number;
}): number {
  return treeWidth + TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS + mainDetailsWidth;
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
    persistenceUnit: "pixels",
  });
  const preferredMainDetailsWidth = getPreferredColumnWidth({
    value: storedMainDetailsWidth,
    defaultWidth: SPAN_DETAILS_FACTORY_WIDTH_PIXELS,
    minimumWidth: SPAN_DETAILS_MIN_WIDTH_PIXELS,
  });
  const defaultDrawerSize = getDetailsPanelDrawerWidth({
    treeWidth: preferredTreeWidth,
    mainDetailsWidth: preferredMainDetailsWidth,
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
  onOverlayResize: (width: number) => number;
  onOverlayResizeEnd: () => void;
  onOverlayResizeStart: (width: number) => void;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
  treePanelRef: RefObject<PanelImperativeHandle | null>;
} {
  const treePanelRef = useRef<PanelImperativeHandle>(null);
  const isOverlayResizingRef = useRef(false);
  const overlayResizeSessionRef = useRef(0);

  const onLayoutChanged = (
    _layout: Layout,
    { isUserInteraction }: LayoutChangedMeta
  ) => {
    const treePanel = treePanelRef.current;
    if (!treePanel) return;

    if (isOverlayResizingRef.current) return;

    if (isUserInteraction) {
      onPreferredTreeWidthChange(treePanel.getSize().inPixels);
      return;
    }

    // Parent drawer and viewport resizes may temporarily force the tree below
    // its preference. Re-request it whenever room returns without persisting
    // the constrained effective width.
    treePanel.resize(preferredTreeWidth);
  };

  const resizeOverlay = (width: number) => {
    const treePanel = treePanelRef.current;
    if (!treePanel) return preferredTreeWidth;
    treePanel.resize(width);
    return treePanel.getSize().inPixels;
  };

  const onOverlayResizeStart = (width: number) => {
    overlayResizeSessionRef.current += 1;
    isOverlayResizingRef.current = true;
    resizeOverlay(width);
  };

  const onOverlayResizeEnd = () => {
    const resizeSession = overlayResizeSessionRef.current;
    const treePanel = treePanelRef.current;
    if (treePanel) {
      onPreferredTreeWidthChange(treePanel.getSize().inPixels);
    }
    requestAnimationFrame(() => {
      if (overlayResizeSessionRef.current === resizeSession) {
        isOverlayResizingRef.current = false;
      }
    });
  };

  return {
    onLayoutChanged,
    onOverlayResize: resizeOverlay,
    onOverlayResizeEnd,
    onOverlayResizeStart,
    treePanelRef,
  };
}
