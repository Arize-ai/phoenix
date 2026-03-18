import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  getAgentPageContextSignature,
  useCurrentAgentPageContext,
} from "@phoenix/agent/context/pageContext";
import type {
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";
import { refreshAgentSessionContext } from "@phoenix/agent/context/refreshAgentContext";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";

type PreviousRefreshSnapshot = {
  pageContextSignature: string;
  pathname: string;
  search: string;
  sessionId: string | null;
};

function createRefreshSnapshot({
  pageContext,
  pageContextSignature,
  sessionId,
}: {
  pageContext: AgentPageContext;
  pageContextSignature: string;
  sessionId: string | null;
}): PreviousRefreshSnapshot {
  return {
    pageContextSignature,
    pathname: pageContext.pathname,
    search: pageContext.search,
    sessionId,
  };
}

function getRefreshReason({
  previousRefresh,
  pageContext,
  pageContextSignature,
  sessionId,
}: {
  previousRefresh: PreviousRefreshSnapshot | null;
  pageContext: AgentPageContext;
  pageContextSignature: string;
  sessionId: string | null;
}): AgentContextRefreshReason | null {
  if (previousRefresh === null || previousRefresh.sessionId !== sessionId) {
    return "navigation";
  }

  if (previousRefresh.pageContextSignature === pageContextSignature) {
    return null;
  }

  const isSameLocation =
    previousRefresh.pathname === pageContext.pathname &&
    previousRefresh.search === pageContext.search;

  return isSameLocation ? "time-range-change" : "navigation";
}

/**
 * Encapsulates the non-visual state and side effects that drive AgentChatPanel.
 */
export function useAgentChatPanelState() {
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

  useEffect(() => {
    if (isOpen && activeSessionId === null) {
      createSession();
    }
  }, [isOpen, activeSessionId, createSession]);

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
      pageContextSignature,
      refreshReason,
      sessionId,
    }: {
      pageContext: AgentPageContext;
      pageContextSignature: string;
      refreshReason: AgentContextRefreshReason;
      sessionId: string | null;
    }) => {
      const refreshRequestId = ++latestRefreshRequestIdRef.current;
      const refreshSnapshot = createRefreshSnapshot({
        pageContext,
        pageContextSignature,
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

  const pageContextSignature = useMemo(
    () => getAgentPageContextSignature(pageContext),
    [pageContext]
  );

  useEffect(() => {
    if (!isOpen || activeSessionId === null) {
      return;
    }

    const refreshReason = getRefreshReason({
      previousRefresh: previousRefreshRef.current,
      pageContext,
      pageContextSignature,
      sessionId: activeSessionId,
    });

    if (!refreshReason) {
      return;
    }

    void refreshSessionContext({
      pageContext,
      pageContextSignature,
      refreshReason,
      sessionId: activeSessionId,
    });
  }, [
    activeSessionId,
    isOpen,
    pageContext,
    pageContextSignature,
    refreshSessionContext,
  ]);

  const handleRefreshContext = useCallback(async () => {
    if (!activeSessionId) {
      return;
    }

    await refreshSessionContext({
      pageContext,
      pageContextSignature,
      refreshReason: "manual",
      sessionId: activeSessionId,
    });
  }, [
    activeSessionId,
    pageContext,
    pageContextSignature,
    refreshSessionContext,
  ]);

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
    handleRefreshContext,
  };
}
