import { css } from "@emotion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Panel, PanelResizeHandle } from "react-resizable-panels";

import {
  getAgentPageContextSignature,
  useCurrentAgentPageContext,
} from "@phoenix/agent/context/pageContext";
import type {
  AgentContextRefreshReason,
  AgentPageContext,
} from "@phoenix/agent/context/pageContextTypes";
import { refreshAgentSessionContext } from "@phoenix/agent/context/refreshAgentContext";
import {
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
} from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize/styles";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";
import { Chat } from "./Chat";

const panelHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border-bottom: 1px solid var(--global-border-color-subtle);
`;

const panelContentCSS = css`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
  border-top: 1px solid var(--global-border-color-subtle);
`;

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

  return previousRefresh.pathname === pageContext.pathname &&
    previousRefresh.search === pageContext.search
    ? "time-range-change"
    : "navigation";
}

export function AgentChatPanel() {
  const isAgentsEnabled = useFeatureFlag("agents");
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

  // Auto-create a session when the panel opens without one
  useEffect(() => {
    if (isOpen && activeSessionId === null) {
      createSession();
    }
  }, [isOpen, activeSessionId, createSession]);

  const menuValue: ModelMenuValue = {
    provider: defaultModelConfig.provider,
    modelName: defaultModelConfig.modelName ?? "",
    ...(defaultModelConfig.customProvider && {
      customProvider: defaultModelConfig.customProvider,
    }),
  };

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

  const params = new URLSearchParams({
    model_name: menuValue.modelName,
    ...(menuValue.customProvider
      ? { provider_type: "custom", provider_id: menuValue.customProvider.id }
      : { provider_type: "builtin", provider: menuValue.provider }),
  });
  const chatApiUrl = prependBasename(`/chat?${params}`);
  const pageContextSignature = useMemo(
    () => getAgentPageContextSignature(pageContext),
    [pageContext]
  );
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

  useEffect(() => {
    if (!isOpen || activeSessionId === null) {
      return;
    }

    const previousRefresh = previousRefreshRef.current;
    const refreshReason = getRefreshReason({
      previousRefresh,
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

  if (!isAgentsEnabled || !isOpen) {
    return null;
  }

  return (
    <>
      <PanelResizeHandle css={compactResizeHandleCSS} />
      <Panel minSize={20} maxSize={50} defaultSize={30}>
        <div css={panelContentCSS}>
          <div css={panelHeaderCSS}>
            <Flex direction="row" alignItems="center" gap="size-50">
              <Icon svg={<Icons.Robot />} />
              <Heading weight="heavy">PXI</Heading>
            </Flex>
            <Flex direction="row" alignItems="center" gap="size-50">
              <Button size="S" variant="quiet" onPress={() => createSession()}>
                New chat
              </Button>
              <IconButton
                size="S"
                aria-label="Close agent chat"
                onPress={() => setIsOpen(false)}
              >
                <Icon svg={<Icons.CloseOutline />} />
              </IconButton>
            </Flex>
          </div>
          <Chat
            key={`${activeSessionId}-${chatApiUrl}`}
            sessionId={activeSessionId}
            chatApiUrl={chatApiUrl}
            modelMenuValue={menuValue}
            onModelChange={handleModelChange}
            onRefreshContext={handleRefreshContext}
          />
        </div>
      </Panel>
    </>
  );
}
