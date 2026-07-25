import type { RefObject } from "react";
import { useEffect, useRef } from "react";
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
  onOverlayResize: (width: number) => number;
  onOverlayResizeEnd: (didMove: boolean) => void;
  onOverlayResizeStart: (width: number) => void;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
  treePanelRef: RefObject<PanelImperativeHandle | null>;
} {
  const groupElementRef = useRef<HTMLDivElement>(null);
  const treePanelRef = useRef<PanelImperativeHandle>(null);
  const isOverlayResizingRef = useRef(false);
  const overlayResizeSessionRef = useRef(0);
  const overlayResizeStartWidthRef = useRef(preferredTreeWidth);

  useEffect(() => {
    const groupElement = groupElementRef.current;
    if (!groupElement) return;

    const reclaimPreferredTreeWidth = () => {
      if (isOverlayResizingRef.current) return;
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
    overlayResizeStartWidthRef.current =
      treePanelRef.current?.getSize().inPixels ?? preferredTreeWidth;
    resizeOverlay(width);
  };

  const onOverlayResizeEnd = (didMove: boolean) => {
    const resizeSession = overlayResizeSessionRef.current;
    const treePanel = treePanelRef.current;
    if (treePanel) {
      const releasedWidth = treePanel.getSize().inPixels;
      const didResize =
        didMove && releasedWidth !== overlayResizeStartWidthRef.current;
      if (didResize) {
        onPreferredTreeWidthChange(releasedWidth);
      } else {
        treePanel.resize(overlayResizeStartWidthRef.current);
      }
    }
    requestAnimationFrame(() => {
      if (overlayResizeSessionRef.current === resizeSession) {
        isOverlayResizingRef.current = false;
      }
    });
  };

  return {
    groupElementRef,
    onLayoutChanged,
    onOverlayResize: resizeOverlay,
    onOverlayResizeEnd,
    onOverlayResizeStart,
    treePanelRef,
  };
}
