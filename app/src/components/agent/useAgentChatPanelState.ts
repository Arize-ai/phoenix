import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  garbageCollectBashToolRuntimes,
  refreshAgentSessionContext,
  useCurrentAgentPageContext,
  type AgentContextRefreshReason,
  type AgentPageContext,
} from "@phoenix/agent/tools/bash";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";

type PreviousRefreshSnapshot = {
  pathname: string;
  search: string;
  timeRangeKey: string | null;
  timeRangeStart: string | null;
  timeRangeEnd: string | null;
  sessionId: string | null;
};

function createRefreshSnapshot({
  pageContext,
  sessionId,
}: {
  pageContext: AgentPageContext;
  sessionId: string | null;
}): PreviousRefreshSnapshot {
  return {
    pathname: pageContext.pathname,
    search: pageContext.search,
    timeRangeKey: pageContext.timeRange?.timeRangeKey ?? null,
    timeRangeStart: pageContext.timeRange?.start ?? null,
    timeRangeEnd: pageContext.timeRange?.end ?? null,
    sessionId,
  };
}

function getRefreshReason({
  previousRefresh,
  pageContext,
  sessionId,
}: {
  previousRefresh: PreviousRefreshSnapshot | null;
  pageContext: AgentPageContext;
  sessionId: string | null;
}): AgentContextRefreshReason | null {
  if (previousRefresh === null || previousRefresh.sessionId !== sessionId) {
    return "navigation";
  }

  const isSameLocation =
    previousRefresh.pathname === pageContext.pathname &&
    previousRefresh.search === pageContext.search;

  if (!isSameLocation) {
    return "navigation";
  }

  const hasTimeRangeChanged =
    previousRefresh.timeRangeKey !==
      (pageContext.timeRange?.timeRangeKey ?? null) ||
    previousRefresh.timeRangeStart !== (pageContext.timeRange?.start ?? null) ||
    previousRefresh.timeRangeEnd !== (pageContext.timeRange?.end ?? null);

  return hasTimeRangeChanged ? "time-range-change" : null;
}

/**
 * Encapsulates the non-visual state and side effects that drive AgentChatPanel.
 */
export function useAgentChatPanelState() {
  const store = useAgentStore();
  const isOpen = useAgentContext((state) => state.isOpen);
  const setIsOpen = useAgentContext((state) => state.setIsOpen);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const createSession = useAgentContext((state) => state.createSession);
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );
  const previousRefreshRef = useRef<PreviousRefreshSnapshot | null>(null);
  const latestRefreshRequestIdRef = useRef(0);
  const pageContext = useCurrentAgentPageContext();
  const autoRefreshPageContext = useMemo<AgentPageContext>(
    () => ({
      pathname: pageContext.pathname,
      search: pageContext.search,
      params: pageContext.params,
      searchParams: pageContext.searchParams,
      routeMatches: pageContext.routeMatches,
      timeRange: pageContext.timeRange,
    }),
    [
      pageContext.pathname,
      pageContext.search,
      pageContext.params,
      pageContext.searchParams,
      pageContext.routeMatches,
      pageContext.timeRange,
    ]
  );

  useEffect(() => {
    if (isOpen && activeSessionId === null) {
      createSession();
    }
  }, [isOpen, activeSessionId, createSession]);

  // Garbage-collect bash runtimes for sessions that are no longer active.
  // Eagerly evicts inactive runtimes so stale `/phoenix` context files don't
  // survive session churn. When session switching ships, the debug flag
  // can become a user-facing retention preference.
  useEffect(() => {
    const syncBashRuntimeRegistry = () => {
      const state = store.getState();
      garbageCollectBashToolRuntimes({
        activeSessionId: state.activeSessionId,
        sessionIds: state.sessions,
        retainInactiveSessions: state.debug.retainInactiveBashSessions,
      });
    };

    syncBashRuntimeRegistry();
    return store.subscribe(syncBashRuntimeRegistry);
  }, [store]);

  const menuValue: ModelMenuValue = useMemo(
    () => ({
      provider: defaultModelConfig.provider,
      modelName: defaultModelConfig.modelName ?? "",
      ...(defaultModelConfig.customProvider && {
        customProvider: defaultModelConfig.customProvider,
      }),
    }),
    [defaultModelConfig]
  );

  const handleModelChange = useCallback(
    (model: ModelMenuValue) => {
      setDefaultModelConfig({
        ...defaultModelConfig,
        provider: model.provider,
        modelName: model.modelName,
        customProvider: model.customProvider ?? null,
      });
    },
    [defaultModelConfig, setDefaultModelConfig]
  );

  const chatApiUrl = useMemo(() => {
    const params = new URLSearchParams({
      model_name: menuValue.modelName,
      ...(menuValue.customProvider
        ? { provider_type: "custom", provider_id: menuValue.customProvider.id }
        : { provider_type: "builtin", provider: menuValue.provider }),
    });

    return prependBasename(`/chat?${params}`);
  }, [menuValue]);

  const refreshSessionContext = useCallback(
    async ({
      pageContext,
      refreshReason,
      sessionId,
    }: {
      pageContext: AgentPageContext;
      refreshReason: AgentContextRefreshReason;
      sessionId: string | null;
    }) => {
      const refreshRequestId = ++latestRefreshRequestIdRef.current;
      const refreshSnapshot = createRefreshSnapshot({
        pageContext,
        sessionId,
      });

      await refreshAgentSessionContext({
        sessionId,
        pageContext,
        refreshReason,
        canReplacePhoenixContext: () =>
          latestRefreshRequestIdRef.current === refreshRequestId,
      });

      if (latestRefreshRequestIdRef.current === refreshRequestId) {
        previousRefreshRef.current = refreshSnapshot;
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen || activeSessionId === null) {
      return;
    }

    const refreshReason = getRefreshReason({
      previousRefresh: previousRefreshRef.current,
      pageContext: autoRefreshPageContext,
      sessionId: activeSessionId,
    });

    if (!refreshReason) {
      return;
    }

    void refreshSessionContext({
      pageContext: autoRefreshPageContext,
      refreshReason,
      sessionId: activeSessionId,
    });
  }, [activeSessionId, autoRefreshPageContext, isOpen, refreshSessionContext]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return {
    isOpen,
    activeSessionId,
    chatApiUrl,
    menuValue,
    createSession,
    closePanel,
    handleModelChange,
  };
}
