import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  garbageCollectBashToolRuntimes,
  refreshAgentSessionContext,
  useCurrentAgentPageContext,
  type AgentPageContext,
} from "@phoenix/agent/tools/bash";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";

/**
 * Snapshot of the values that were current the last time the bash tool's
 * `/phoenix` context files were regenerated. Compared against the live
 * page context to decide whether a navigation-triggered refresh is needed.
 */
type PreviousRefreshSnapshot = {
  pathname: string;
  search: string;
  sessionId: string | null;
};

/** Captures the current page context + session into a comparable snapshot. */
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
    sessionId,
  };
}

/**
 * Returns `true` if the page context has changed in a way that warrants
 * regenerating the bash tool's `/phoenix` context files, comparing
 * the current state against the last refresh snapshot.
 *
 * A new or different session always triggers a refresh. Within the same
 * session, a change in pathname or search params triggers a refresh.
 */
function shouldRefreshContext({
  previousRefresh,
  pageContext,
  sessionId,
}: {
  previousRefresh: PreviousRefreshSnapshot | null;
  pageContext: AgentPageContext;
  sessionId: string | null;
}): boolean {
  if (previousRefresh === null || previousRefresh.sessionId !== sessionId) {
    return true;
  }

  return (
    previousRefresh.pathname !== pageContext.pathname ||
    previousRefresh.search !== pageContext.search
  );
}

/**
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Creates a session automatically when the panel opens
 * - Refreshes the bash tool's `/phoenix` context files on navigation
 *   (races are resolved via a monotonic request ID)
 * - Garbage-collects bash runtimes for sessions that are no longer active
 * - Derives the chat API URL and model menu value from the store
 *
 * All bash-tool-specific side effects are co-located here so that
 * {@link AgentContext} and the rest of the app remain tool-agnostic.
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
    }),
    [
      pageContext.pathname,
      pageContext.search,
      pageContext.params,
      pageContext.searchParams,
      pageContext.routeMatches,
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
      sessionId,
    }: {
      pageContext: AgentPageContext;
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
        refreshReason: "navigation",
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

    const needsRefresh = shouldRefreshContext({
      previousRefresh: previousRefreshRef.current,
      pageContext: autoRefreshPageContext,
      sessionId: activeSessionId,
    });

    if (!needsRefresh) {
      return;
    }

    void refreshSessionContext({
      pageContext: autoRefreshPageContext,
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
