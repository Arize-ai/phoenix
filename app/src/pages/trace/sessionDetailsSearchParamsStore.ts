import type { useSearchParams } from "react-router";

import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
  SESSION_VIEW_PARAM,
} from "@phoenix/constants/searchParams";

type SearchParamsSetter = ReturnType<typeof useSearchParams>[1];

export type SessionSpanSelection = {
  spanNodeId: string | null;
  traceId: string | null;
};

export type SessionDetailsSearchParamsStore = ReturnType<
  typeof createSessionDetailsSearchParamsStore
>;

export function createSessionDetailsSearchParamsStore(
  initialSearchParams: URLSearchParams
) {
  let searchParams = new URLSearchParams(initialSearchParams);
  let routerSetter: SearchParamsSetter | null = null;
  let sessionViewParam = searchParams.get(SESSION_VIEW_PARAM);
  let selection: SessionSpanSelection = {
    spanNodeId: searchParams.get(SELECTED_SPAN_NODE_ID_PARAM),
    traceId: searchParams.get(SELECTED_TRACE_ID_PARAM),
  };
  let pendingSelection: SessionSpanSelection | null = null;
  const sessionViewListeners = new Set<() => void>();
  // Navigation renders the optimistic selection immediately. Content-ready
  // URL synchronization and external router changes remain separate signals.
  const spanSelectionListeners = new Set<() => void>();
  const externalSelectionListeners = new Set<
    (selection: SessionSpanSelection) => void
  >();

  const replaceSearchParams = (nextSearchParams: URLSearchParams) => {
    searchParams = nextSearchParams;
    routerSetter?.(nextSearchParams, { replace: true });
  };

  return {
    connectToRouter(
      nextSearchParams: URLSearchParams,
      nextRouterSetter: SearchParamsSetter
    ) {
      routerSetter = nextRouterSetter;
      searchParams = new URLSearchParams(nextSearchParams);

      const nextSessionViewParam = searchParams.get(SESSION_VIEW_PARAM);
      if (nextSessionViewParam !== sessionViewParam) {
        sessionViewParam = nextSessionViewParam;
        sessionViewListeners.forEach((listener) => listener());
      }

      const nextSelection = {
        spanNodeId: searchParams.get(SELECTED_SPAN_NODE_ID_PARAM),
        traceId: searchParams.get(SELECTED_TRACE_ID_PARAM),
      };
      if (
        pendingSelection &&
        (nextSelection.spanNodeId !== pendingSelection.spanNodeId ||
          nextSelection.traceId !== pendingSelection.traceId)
      ) {
        return;
      }
      pendingSelection = null;
      if (
        nextSelection.spanNodeId !== selection.spanNodeId ||
        nextSelection.traceId !== selection.traceId
      ) {
        selection = nextSelection;
        spanSelectionListeners.forEach((listener) => listener());
        externalSelectionListeners.forEach((listener) => listener(selection));
      }
    },
    getSessionViewParam: () => {
      return sessionViewParam;
    },
    getSpanSelection() {
      return selection;
    },
    prepareSpanSelection(nextSelection: {
      spanNodeId: string;
      traceId: string;
    }) {
      selection = nextSelection;
      pendingSelection = nextSelection;
      spanSelectionListeners.forEach((listener) => listener());
    },
    selectTrace(traceId: string) {
      selection = { spanNodeId: null, traceId };
      pendingSelection = null;
      spanSelectionListeners.forEach((listener) => listener());
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set(SELECTED_TRACE_ID_PARAM, traceId);
      nextSearchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
      replaceSearchParams(nextSearchParams);
    },
    synchronizeSpanSelection(nextSelection: {
      spanNodeId: string;
      traceId: string;
    }) {
      if (
        selection.spanNodeId !== nextSelection.spanNodeId ||
        selection.traceId !== nextSelection.traceId
      ) {
        return;
      }
      pendingSelection = null;
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set(SELECTED_TRACE_ID_PARAM, nextSelection.traceId);
      nextSearchParams.set(
        SELECTED_SPAN_NODE_ID_PARAM,
        nextSelection.spanNodeId
      );
      replaceSearchParams(nextSearchParams);
    },
    setSessionViewParam(nextSessionViewParam: string) {
      if (nextSessionViewParam !== sessionViewParam) {
        sessionViewParam = nextSessionViewParam;
        sessionViewListeners.forEach((listener) => listener());
      }
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set(SESSION_VIEW_PARAM, nextSessionViewParam);
      replaceSearchParams(nextSearchParams);
    },
    subscribeToExternalSelection(
      listener: (selection: SessionSpanSelection) => void
    ) {
      externalSelectionListeners.add(listener);
      return () => {
        externalSelectionListeners.delete(listener);
      };
    },
    subscribeToSpanSelection: (listener: () => void) => {
      spanSelectionListeners.add(listener);
      return () => {
        spanSelectionListeners.delete(listener);
      };
    },
    subscribeToSessionView: (listener: () => void) => {
      sessionViewListeners.add(listener);
      return () => {
        sessionViewListeners.delete(listener);
      };
    },
  };
}
