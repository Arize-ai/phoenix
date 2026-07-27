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
  TRACE_TREE_MIN_WIDTH_PIXELS,
} from "@phoenix/constants";
import type { SizeValue } from "@phoenix/types/sizing";

import { evaluateInt } from "./detailsPanelSizing/expr";
import type { SizingState } from "./detailsPanelSizing/machine";
import {
  GESTURE_TREE,
  mainFromDrawerExpr,
  previewOpenDrawerWidth,
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
  requestedTreeWidth,
  startDrawerWidth,
  startMainWidth,
  startTreeWidth,
}: {
  maximumDrawerWidth: number;
  requestedTreeWidth: number;
  startDrawerWidth: number;
  startMainWidth: number;
  startTreeWidth: number;
}): { drawerWidth: number; treeWidth: number } {
  const exprs = treeDragExprs(KERNEL_INT_VAR);
  const env = {
    ints: {
      px: Math.round(requestedTreeWidth),
      dragStartDrawer: startDrawerWidth,
      dragStartTree: startTreeWidth,
      dragStartMain: startMainWidth,
      dragMaxDrawer: maximumDrawerWidth,
    },
    bools: {},
  };
  return {
    drawerWidth: evaluateInt(exprs.drawer, env),
    treeWidth: evaluateInt(exprs.tree, env),
  };
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
  return { preferredTreeWidth: state.prefTree, onPreferredTreeWidthChange };
}

/**
 * Drawer-owning pages (trace, session, evaluator). Mount/unmount are the
 * panel's open/close: the machine outlives the page, so reopening derives
 * from in-memory preferences — never from storage.
 */
export function useDetailsPanelSizing(): {
  defaultDrawerSize: SizeValue;
  onDrawerResize: (sizePercent: number, sizePixels: number) => void;
  onDrawerSizeChange: (sizePercent: number, sizePixels: number) => void;
  onPreferredTreeWidthChange: (width: number) => void;
  preferredTreeWidth: number;
} {
  const state = useSizingState();
  const { onPreferredTreeWidthChange } = useSharedTreePreference();

  useLayoutEffect(() => {
    const store = getDetailsPanelSizingStore();
    store.dispatch({ type: "OPEN" });
    return () => {
      store.dispatch({ type: "CLOSE" });
    };
  }, []);

  // First render happens before the OPEN dispatch; preview the exact width
  // the machine's open rule will produce from the same state.
  const defaultDrawerSize = state.open
    ? state.renderedDrawer
    : previewOpenDrawerWidth(state);

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
    onDrawerResize,
    onDrawerSizeChange,
    onPreferredTreeWidthChange,
    preferredTreeWidth: state.prefTree,
  };
}

/* --------------------------- tree panel adapter --------------------------- */

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
  const isDrawerMode = drawerResizeController != null;
  const groupElementRef = useRef<HTMLDivElement>(null);
  const treePanelRef = useRef<PanelImperativeHandle | null>(null);
  const pendingTreeResizeFrameRef = useRef<number | null>(null);

  // Dialog-mode drag session (drawer mode keeps its session in the machine).
  const dialogDragRef = useRef<{
    startDrawerWidth: number;
    startMainWidth: number;
    startTreeWidth: number;
    latestTreeWidth: number;
  } | null>(null);

  /**
   * Mechanically apply a width to the tree panel. Growing the drawer commits
   * through React state, so retry once on the next frame after that wider
   * group has laid out; the immediate call still handles the fixed-drawer
   * portion of the same gesture without a frame of lag.
   */
  const applyTreeWidth = useCallback((treeWidth: number) => {
    const treePanel = treePanelRef.current;
    if (!treePanel) return;
    treePanel.resize(treeWidth);
    if (treePanel.getSize().inPixels !== treeWidth) {
      if (pendingTreeResizeFrameRef.current != null) {
        cancelAnimationFrame(pendingTreeResizeFrameRef.current);
      }
      pendingTreeResizeFrameRef.current = requestAnimationFrame(() => {
        pendingTreeResizeFrameRef.current = null;
        treePanelRef.current?.resize(treeWidth);
      });
    }
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

  useEffect(() => {
    return () => {
      if (pendingTreeResizeFrameRef.current != null) {
        cancelAnimationFrame(pendingTreeResizeFrameRef.current);
      }
    };
  }, []);

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
        Math.max(
          TRACE_TREE_MIN_WIDTH_PIXELS,
          Math.min(preferredTreeWidth, availableTreeWidth)
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
  }, [isDrawerMode, preferredTreeWidth, applyTreeWidth]);

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
      onPreferredTreeWidthChange(treePanel.getSize().inPixels);
      if (isDrawerMode) applyMachineGeometry();
      return;
    }

    // Constraint-driven layout changes re-request the authoritative width
    // instead of persisting the compressed one (CP-3).
    if (isDrawerMode) {
      applyTreeWidth(store.getState().renderedTree);
    } else {
      applyTreeWidth(preferredTreeWidth);
    }
  };

  const onTreeResizeStart = (renderedTreeWidth: number) => {
    if (isDrawerMode) {
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

  const onTreeResize = (requestedTreeWidth: number) => {
    if (isDrawerMode) {
      const store = getDetailsPanelSizingStore();
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
      requestedTreeWidth,
      startDrawerWidth: session.startDrawerWidth,
      startMainWidth: session.startMainWidth,
      startTreeWidth: session.startTreeWidth,
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
      getDetailsPanelSizingStore().dispatch({
        type: shouldCommit ? "TREE_END" : "TREE_CANCEL",
      });
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
      onPreferredTreeWidthChange(session.latestTreeWidth);
    } else {
      applyTreeWidth(session.startTreeWidth);
    }
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
