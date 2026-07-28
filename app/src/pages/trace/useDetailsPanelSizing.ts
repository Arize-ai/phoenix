/**
 * React adapter for the verified details-panel sizing machine.
 *
 * All sizing *decisions* live in `detailsPanelSizing/machine.ts` — a pure,
 * mechanically verified transition system (see `detailsPanelSizing/verify/`).
 * This file only translates: DOM and library callbacks become machine events,
 * and machine state becomes panel/drawer size requests. It must not decide
 * widths, ordering, or persistence; if a change here needs a branch on a
 * width value, that branch belongs in the machine where it will be proven.
 *
 * Two modes exist:
 *
 * - Drawer mode (TracePage, SessionPage, EvaluatorTracePage): the enclosing
 *   Drawer exists, so tree drags may grow it. Every gesture flows through the
 *   machine.
 * - Dialog mode (PlaygroundRunTraceDialog, TraceDetailsDialog): no drawer;
 *   drag geometry is dialog-local, and only the deliberate release enters the
 *   machine through TREE_PREF_SET, which is how all surfaces share one tree
 *   preference (XS-3).
 */

import type { RefObject } from "react";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type {
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
} from "react-resizable-panels";

import { DrawerResizeContext } from "@phoenix/components/core/overlay/DrawerContext";
import {
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS,
  TRACE_TREE_COLLAPSED_WIDTH_PIXELS,
  TRACE_TREE_MIN_WIDTH_PIXELS,
} from "@phoenix/constants";
import type { SizeValue } from "@phoenix/types/sizing";

import { evaluateInt } from "./detailsPanelSizing/expr";
import type { SizingState } from "./detailsPanelSizing/machine";
import {
  GESTURE_TREE,
  mainFromDrawerExpr,
  minimumDrawerExpr,
  previewOpenDrawerWidth,
  previewMaximumDrawerWidth,
  treeDragExprs,
} from "./detailsPanelSizing/machine";
import { getDetailsPanelSizingStore } from "./detailsPanelSizing/store";

/* ----------------------- kernel-backed pure helpers ----------------------- */

const KERNEL_INT_VAR = { kind: "intVar", name: "px" } as const;

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

/** DW-4: a pure sum over the ordered columns and separators. */
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

export function getMinimumDetailsPanelDrawerWidth({
  isCollapsed,
  treeAddonWidth,
}: {
  isCollapsed: boolean;
  treeAddonWidth: number;
}): number {
  return evaluateInt(
    minimumDrawerExpr(
      {
        kind: "int",
        value: Math.max(0, Math.round(treeAddonWidth)),
      },
      { kind: "bool", value: isCollapsed }
    ),
    { ints: {}, bools: {} }
  );
}

/** DW-3, evaluated from the machine's kernel expression. */
export function getMainDetailsWidthFromDrawer({
  drawerWidth,
  treeWidth,
}: {
  drawerWidth: number;
  treeWidth: number;
}): number {
  return evaluateInt(
    mainFromDrawerExpr(
      { kind: "int", value: drawerWidth },
      { kind: "int", value: treeWidth }
    ),
    { ints: {}, bools: {} }
  );
}

/**
 * TC-8/TC-9 drag mapping, evaluated from the machine's kernel expression so
 * dialog-mode drags and the verified drawer-mode drags share one algebra.
 */
export function getTreeDividerDragLayout({
  maximumDrawerWidth,
  maximumTreeWidth,
  requestedTreeWidth,
  startDrawerWidth,
  startMainWidth,
  startTreeWidth,
  treeAddonWidth = 0,
}: {
  maximumDrawerWidth: number;
  maximumTreeWidth: number;
  requestedTreeWidth: number;
  startDrawerWidth: number;
  startMainWidth: number;
  startTreeWidth: number;
  treeAddonWidth?: number;
}): { drawerWidth: number; treeWidth: number } {
  const exprs = treeDragExprs(KERNEL_INT_VAR);
  const env = {
    ints: {
      px: Math.round(requestedTreeWidth),
      dragStartDrawer: startDrawerWidth,
      dragStartTree: startTreeWidth,
      dragStartMain: startMainWidth,
      dragMaxDrawer: maximumDrawerWidth,
      treeMax: Math.max(TRACE_TREE_MIN_WIDTH_PIXELS, maximumTreeWidth),
      treeAddon: Math.max(0, Math.round(treeAddonWidth)),
    },
    bools: {},
  };
  return {
    drawerWidth: evaluateInt(exprs.drawer, env),
    treeWidth: evaluateInt(exprs.tree, env),
  };
}

/**
 * Maps the compact tree divider's fixed-origin pointer coordinate to the
 * enclosing drawer width. The compact rail stays fixed, so leftward travel
 * grows the main column and moves the drawer's left edge with the pointer.
 */
export function getCompactTreeDividerDrawerWidth({
  requestedTreeWidth,
  startDrawerWidth,
}: {
  requestedTreeWidth: number;
  startDrawerWidth: number;
}): number {
  return (
    startDrawerWidth +
    TRACE_TREE_COLLAPSED_WIDTH_PIXELS -
    Math.round(requestedTreeWidth)
  );
}

/* ------------------------------- store hooks ------------------------------ */

function useSizingState(): SizingState {
  const store = getDetailsPanelSizingStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/**
 * Shared tree-column preference for embedded trace surfaces that have no
 * enclosing drawer (XS-3). The setter dispatches the machine's single
 * sanctioned non-drawer preference mutator.
 */
export function useSharedTreePreference(): {
  preferredTreeWidth: number;
  onPreferredTreeWidthChange: (width: number) => void;
} {
  const state = useSizingState();
  const onPreferredTreeWidthChange = useCallback((width: number) => {
    getDetailsPanelSizingStore().dispatch({
      type: "TREE_PREF_SET",
      px: Math.round(width),
    });
  }, []);
  return {
    onPreferredTreeWidthChange,
    preferredTreeWidth: state.prefTree,
  };
}

/**
 * Drawer-owning pages (trace, session, evaluator). Mount/unmount are the
 * panel's open/close: the machine outlives the page, so reopening derives
 * from in-memory preferences — never from storage.
 */
export function useDetailsPanelSizing({
  treeAddonWidth = 0,
  treeMaximumWidth,
}: {
  treeAddonWidth?: number;
  treeMaximumWidth: number;
}): {
  defaultDrawerSize: SizeValue;
  isTreeCollapsed: boolean;
  maximumDrawerSize: number;
  minimumDrawerSize: number;
  onDrawerResize: (sizePercent: number, sizePixels: number) => void;
  onDrawerSizeChange: (sizePercent: number, sizePixels: number) => void;
  onPreferredTreeWidthChange: (width: number) => void;
  onTreeCollapsedChange: (isCollapsed: boolean) => void;
  preferredTreeWidth: number;
} {
  const state = useSizingState();
  const { onPreferredTreeWidthChange } = useSharedTreePreference();
  const onTreeCollapsedChange = (isCollapsed: boolean) => {
    getDetailsPanelSizingStore().dispatch({
      type: isCollapsed ? "TREE_COLLAPSE" : "TREE_EXPAND",
    });
  };

  useLayoutEffect(() => {
    const store = getDetailsPanelSizingStore();
    store.dispatch({
      type: "TREE_MAX_SET",
      px: Math.max(TRACE_TREE_MIN_WIDTH_PIXELS, Math.round(treeMaximumWidth)),
    });
    store.dispatch({
      type: "TREE_ADDON_SET",
      px: Math.max(0, Math.round(treeAddonWidth)),
    });
  }, [treeAddonWidth, treeMaximumWidth]);

  useLayoutEffect(() => {
    const store = getDetailsPanelSizingStore();
    store.dispatch({ type: "OPEN" });
    return () => {
      store.dispatch({ type: "CLOSE" });
    };
  }, []);

  // First render happens before the OPEN dispatch; preview the exact width
  // the machine's open rule will produce from the same state.
  const defaultDrawerSize = previewOpenDrawerWidth(
    state,
    treeAddonWidth,
    treeMaximumWidth
  );
  const minimumDrawerSize = getMinimumDetailsPanelDrawerWidth({
    isCollapsed: state.collapsed,
    treeAddonWidth,
  });
  const maximumDrawerSize = previewMaximumDrawerWidth(
    state,
    treeAddonWidth,
    treeMaximumWidth
  );

  const onDrawerResize = useCallback((_: number, sizePixels: number) => {
    getDetailsPanelSizingStore().dispatch({
      type: "OUTER_MOVE",
      px: Math.round(sizePixels),
    });
  }, []);

  const onDrawerSizeChange = useCallback((_: number, sizePixels: number) => {
    getDetailsPanelSizingStore().dispatch({
      type: "OUTER_END",
      px: Math.round(sizePixels),
    });
  }, []);

  return {
    defaultDrawerSize,
    isTreeCollapsed: state.collapsed,
    maximumDrawerSize,
    minimumDrawerSize,
    onDrawerResize,
    onDrawerSizeChange,
    onPreferredTreeWidthChange,
    onTreeCollapsedChange,
    preferredTreeWidth: state.prefTree,
  };
}

/* --------------------------- tree panel adapter --------------------------- */

export function usePreferredTreePanel({
  preferredTreeWidth,
  onPreferredTreeWidthChange,
  treeAddonWidth = 0,
  treeMaximumWidth,
}: {
  preferredTreeWidth: number;
  onPreferredTreeWidthChange: (width: number) => void;
  treeAddonWidth?: number;
  treeMaximumWidth: number;
}): {
  defaultTreeWidth: number;
  groupElementRef: RefObject<HTMLDivElement | null>;
  isTreeCollapsed: boolean;
  isTreeSeparatorDisabled: boolean;
  maximumTreeWidth: number | undefined;
  minimumTreeWidth: number;
  onTreeResize: (width: number) => number;
  onTreeResizeEnd: (options: {
    didMove: boolean;
    shouldCommit: boolean;
  }) => void;
  onTreeResizeStart: (width: number) => void;
  onTreeToggle: (() => void) | undefined;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
  treePanelRef: RefObject<PanelImperativeHandle | null>;
} {
  const sizingState = useSizingState();
  const drawerResizeController = useContext(DrawerResizeContext);
  const isDrawerMode = drawerResizeController != null;
  const groupElementRef = useRef<HTMLDivElement>(null);
  const treePanelRef = useRef<PanelImperativeHandle | null>(null);
  const normalizedTreeMaximumWidth = Math.max(
    TRACE_TREE_MIN_WIDTH_PIXELS,
    Math.round(treeMaximumWidth)
  );
  const normalizedTreeAddonWidth = Math.min(
    normalizedTreeMaximumWidth - TRACE_TREE_MIN_WIDTH_PIXELS,
    Math.max(0, Math.round(treeAddonWidth))
  );
  const isTreeCollapsed = isDrawerMode && sizingState.collapsed;
  const expandedMinimumTreeWidth =
    TRACE_TREE_MIN_WIDTH_PIXELS + normalizedTreeAddonWidth;
  const minimumTreeWidth = isTreeCollapsed
    ? TRACE_TREE_COLLAPSED_WIDTH_PIXELS
    : expandedMinimumTreeWidth;
  const expandedMaximumTreeWidth = normalizedTreeMaximumWidth;
  const maximumTreeWidth = isTreeCollapsed
    ? TRACE_TREE_COLLAPSED_WIDTH_PIXELS
    : normalizedTreeMaximumWidth;
  const preferredRenderedTreeWidth = Math.min(
    preferredTreeWidth + normalizedTreeAddonWidth,
    expandedMaximumTreeWidth
  );
  const defaultTreeWidth = isTreeCollapsed
    ? TRACE_TREE_COLLAPSED_WIDTH_PIXELS
    : preferredRenderedTreeWidth;

  // A compact-divider drag resizes the enclosing drawer while the 48px tree
  // rail stays fixed. Keep its origin separate from the expanded tree drag.
  const compactDragStartDrawerWidthRef = useRef<number | null>(null);

  // Dialog-mode drag session (drawer mode keeps its session in the machine).
  const dialogDragRef = useRef<{
    startDrawerWidth: number;
    startMainWidth: number;
    startTreeWidth: number;
    latestTreeWidth: number;
  } | null>(null);

  /**
   * Mechanically apply a width to the tree panel. When the drawer must resize
   * first, its context update causes the reconciliation layout effect below to
   * run again against the new group width before paint.
   */
  const applyTreeWidth = useCallback((treeWidth: number) => {
    treePanelRef.current?.resize(treeWidth);
  }, []);

  /** Drawer mode: reconcile rendered machine geometry into the DOM. */
  const applyMachineGeometry = useCallback(() => {
    if (!isDrawerMode) return;
    const state = getDetailsPanelSizingStore().getState();
    if (
      drawerResizeController &&
      drawerResizeController.getSizePixels() !== state.renderedDrawer
    ) {
      drawerResizeController.resizeToPixels(state.renderedDrawer);
    }
    applyTreeWidth(state.renderedTree);
  }, [isDrawerMode, drawerResizeController, applyTreeWidth]);

  useLayoutEffect(() => {
    const store = getDetailsPanelSizingStore();
    store.dispatch({
      type: "TREE_MAX_SET",
      px: normalizedTreeMaximumWidth,
    });
    store.dispatch({
      type: "TREE_ADDON_SET",
      px: normalizedTreeAddonWidth,
    });
  }, [normalizedTreeAddonWidth, normalizedTreeMaximumWidth]);

  useLayoutEffect(() => {
    if (isDrawerMode) {
      applyMachineGeometry();
    } else {
      applyTreeWidth(defaultTreeWidth);
    }
  }, [
    applyMachineGeometry,
    applyTreeWidth,
    defaultTreeWidth,
    isDrawerMode,
    sizingState.collapsed,
    sizingState.renderedDrawer,
    sizingState.renderedTree,
  ]);

  // Group-size measurement. Drawer mode feeds the machine (whose gesture
  // guards decide whether measurements may re-split — the machine ignores
  // them mid-drag). Dialog mode reclaims the preferred width locally.
  useEffect(() => {
    const groupElement = groupElementRef.current;
    if (!groupElement) return undefined;

    const measure = () => {
      const groupWidth = Math.round(groupElement.getBoundingClientRect().width);
      if (isDrawerMode) {
        getDetailsPanelSizingStore().dispatch({
          type: "ALLOCATION",
          px: groupWidth,
        });
        applyTreeWidth(getDetailsPanelSizingStore().getState().renderedTree);
        return;
      }
      if (dialogDragRef.current) {
        applyTreeWidth(dialogDragRef.current.latestTreeWidth);
        return;
      }
      const availableTreeWidth =
        groupWidth -
        TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS -
        SPAN_DETAILS_MIN_WIDTH_PIXELS;
      applyTreeWidth(
        Math.min(
          expandedMaximumTreeWidth,
          Math.max(
            expandedMinimumTreeWidth,
            Math.min(preferredRenderedTreeWidth, availableTreeWidth)
          )
        )
      );
    };

    let animationFrameId: number | null = null;
    const scheduleMeasure = () => {
      if (animationFrameId != null) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        measure();
      });
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(groupElement);
    scheduleMeasure();
    return () => {
      resizeObserver.disconnect();
      if (animationFrameId != null) cancelAnimationFrame(animationFrameId);
    };
  }, [
    applyTreeWidth,
    isDrawerMode,
    expandedMaximumTreeWidth,
    expandedMinimumTreeWidth,
    preferredRenderedTreeWidth,
  ]);

  const onLayoutChanged = (
    _layout: Layout,
    { isUserInteraction }: LayoutChangedMeta
  ) => {
    const treePanel = treePanelRef.current;
    if (!treePanel) return;
    const store = getDetailsPanelSizingStore();

    if (isDrawerMode && store.getState().gesture === GESTURE_TREE) return;
    if (dialogDragRef.current) return;

    if (isUserInteraction) {
      // The panel library's own (keyboard) separator resize is a deliberate
      // release; TREE_PREF_SET re-splits rendered geometry in the machine.
      const renderedWidth = treePanel.getSize().inPixels;
      onPreferredTreeWidthChange(
        Math.max(
          TRACE_TREE_MIN_WIDTH_PIXELS,
          renderedWidth - normalizedTreeAddonWidth
        )
      );
      if (isDrawerMode) applyMachineGeometry();
      return;
    }

    // Constraint-driven layout changes re-request the authoritative width
    // instead of persisting the compressed one (CP-3).
    if (isDrawerMode) {
      applyTreeWidth(store.getState().renderedTree);
    } else {
      applyTreeWidth(defaultTreeWidth);
    }
  };

  const onTreeResizeStart = (renderedTreeWidth: number) => {
    if (isDrawerMode) {
      if (isTreeCollapsed) {
        compactDragStartDrawerWidthRef.current =
          getDetailsPanelSizingStore().getState().renderedDrawer;
        return;
      }
      getDetailsPanelSizingStore().dispatch({ type: "TREE_START" });
      return;
    }
    const groupWidth = Math.round(
      groupElementRef.current?.getBoundingClientRect().width ?? 0
    );
    const startTreeWidth = Math.round(
      treePanelRef.current?.getSize().inPixels ?? renderedTreeWidth
    );
    dialogDragRef.current = {
      startDrawerWidth: groupWidth,
      startMainWidth: Math.max(
        SPAN_DETAILS_MIN_WIDTH_PIXELS,
        groupWidth - startTreeWidth - TRACE_DETAILS_SEPARATOR_WIDTH_PIXELS
      ),
      startTreeWidth,
      latestTreeWidth: startTreeWidth,
    };
  };

  const onTreeToggle = () => {
    getDetailsPanelSizingStore().dispatch({
      type: isTreeCollapsed ? "TREE_EXPAND" : "TREE_COLLAPSE",
    });
  };

  const onTreeResize = (requestedTreeWidth: number) => {
    if (isDrawerMode) {
      const store = getDetailsPanelSizingStore();
      const compactDragStartDrawerWidth =
        compactDragStartDrawerWidthRef.current;
      if (compactDragStartDrawerWidth != null) {
        const state = store.dispatch({
          type: "OUTER_MOVE",
          px: getCompactTreeDividerDrawerWidth({
            requestedTreeWidth,
            startDrawerWidth: compactDragStartDrawerWidth,
          }),
        });
        applyMachineGeometry();
        return state.renderedTree;
      }
      const state = store.dispatch({
        type: "TREE_MOVE",
        px: Math.round(requestedTreeWidth),
      });
      applyMachineGeometry();
      return state.renderedTree;
    }
    const session = dialogDragRef.current;
    if (!session) return Math.round(requestedTreeWidth);
    // No enclosing drawer: the group cannot grow, so the maximum drawer width
    // is the starting group width (growth capacity zero).
    const layout = getTreeDividerDragLayout({
      maximumDrawerWidth: session.startDrawerWidth,
      maximumTreeWidth: normalizedTreeMaximumWidth,
      requestedTreeWidth,
      startDrawerWidth: session.startDrawerWidth,
      startMainWidth: session.startMainWidth,
      startTreeWidth: session.startTreeWidth,
      treeAddonWidth: normalizedTreeAddonWidth,
    });
    session.latestTreeWidth = layout.treeWidth;
    applyTreeWidth(layout.treeWidth);
    return layout.treeWidth;
  };

  const onTreeResizeEnd = ({
    didMove,
    shouldCommit,
  }: {
    didMove: boolean;
    shouldCommit: boolean;
  }) => {
    if (isDrawerMode) {
      const store = getDetailsPanelSizingStore();
      const compactDragStartDrawerWidth =
        compactDragStartDrawerWidthRef.current;
      compactDragStartDrawerWidthRef.current = null;
      if (compactDragStartDrawerWidth != null) {
        const state = store.getState();
        store.dispatch({
          type: "OUTER_END",
          px: shouldCommit ? state.renderedDrawer : compactDragStartDrawerWidth,
        });
      } else {
        store.dispatch({
          type: shouldCommit ? "TREE_END" : "TREE_CANCEL",
        });
      }
      applyMachineGeometry();
      return;
    }
    const session = dialogDragRef.current;
    dialogDragRef.current = null;
    if (!session) return;
    const didResize =
      shouldCommit &&
      didMove &&
      session.latestTreeWidth !== session.startTreeWidth;
    if (didResize) {
      onPreferredTreeWidthChange(
        session.latestTreeWidth - normalizedTreeAddonWidth
      );
    } else {
      applyTreeWidth(session.startTreeWidth);
    }
  };

  return {
    defaultTreeWidth,
    groupElementRef,
    isTreeCollapsed,
    isTreeSeparatorDisabled: false,
    maximumTreeWidth,
    minimumTreeWidth,
    onLayoutChanged,
    onTreeResize,
    onTreeResizeEnd,
    onTreeResizeStart,
    onTreeToggle: isDrawerMode ? onTreeToggle : undefined,
    treePanelRef,
  };
}
