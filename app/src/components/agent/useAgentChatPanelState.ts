import { useCallback, useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";

import type { AgentModelSelection } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentState } from "@phoenix/store/agentStore";
import { DRAFT_SESSION_ID } from "@phoenix/store/agentStore";
import type { ModelConfig } from "@phoenix/store/playground/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";
import type { useAgentChatPanelStateUpdateAgentSessionModelMutation } from "./__generated__/useAgentChatPanelStateUpdateAgentSessionModelMutation.graphql";
import type { AgentChatOperationError } from "./useAgentChat";

/**
 * Canonical {@link ModelConfig} → wire model selection converter. Every path
 * that asserts or persists a session's model (sends, compaction, session
 * creation, model changes) derives its selection here so the asserted model
 * can never drift from the config the store holds.
 */
export function toAgentModelSelection(
  config: ModelConfig
): AgentModelSelection {
  if (config.customProvider) {
    return {
      providerType: "custom",
      providerId: config.customProvider.id,
      modelName: config.modelName ?? "",
    };
  }
  return {
    providerType: "builtin",
    provider: config.provider,
    modelName: config.modelName ?? "",
    ...((config.provider === "OPENAI" ||
      config.provider === "AZURE_OPENAI") && {
      openaiApiType:
        config.openaiApiType === "CHAT_COMPLETIONS"
          ? "chat_completions"
          : "responses",
    }),
  };
}

/** Convert a resolved selection into the GraphQL `AgentModelSelectionInput`. */
export function toAgentModelSelectionInput(model: AgentModelSelection) {
  if (model.providerType === "custom") {
    return {
      custom: {
        providerId: model.providerId,
        modelName: model.modelName,
      },
    };
  }
  return {
    builtin: {
      provider: model.provider,
      modelName: model.modelName,
      openaiApiType:
        model.openaiApiType === "chat_completions"
          ? ("CHAT_COMPLETIONS" as const)
          : ("RESPONSES" as const),
    },
  };
}

const updateAgentSessionModelMutation = graphql`
  mutation useAgentChatPanelStateUpdateAgentSessionModelMutation(
    $input: UpdateAgentSessionModelInput!
  ) {
    updateAgentSessionModel(input: $input) {
      agentSession {
        id
        ...agentSessionModel_session
      }
    }
  }
`;

/**
 * Derives the chat request's model selection from the store's current default
 * model config. The chat transport reads this at request time so a model
 * change always applies to the next send, even when the runtime chat was
 * created by a since-unmounted surface (e.g. the draft that started the
 * session).
 */
export function selectAgentModel(
  state: Pick<AgentState, "defaultModelConfig"> &
    Partial<Pick<AgentState, "modelConfigBySessionId">>,
  sessionId?: string | null
): AgentModelSelection {
  const modelConfig =
    sessionId && sessionId !== DRAFT_SESSION_ID
      ? (state.modelConfigBySessionId?.[sessionId] ?? state.defaultModelConfig)
      : state.defaultModelConfig;
  return toAgentModelSelection(modelConfig);
}

/**
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Derives the model menu value from the store
 */
export function useAgentChatPanelState(sessionId?: string | null) {
  const isOpen = useAgentContext((state) => state.isOpen);
  const setIsOpen = useAgentContext((state) => state.setIsOpen);
  const position = useAgentContext((state) => state.position);
  const setPosition = useAgentContext((state) => state.setPosition);
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
  );
  const setDefaultModelConfig = useAgentContext(
    (state) => state.setDefaultModelConfig
  );
  const sessionModelConfig = useAgentContext((state) =>
    sessionId && sessionId !== DRAFT_SESSION_ID
      ? state.modelConfigBySessionId[sessionId]
      : undefined
  );
  const setSessionModelConfig = useAgentContext(
    (state) => state.setSessionModelConfig
  );
  const setSessionModelWritePending = useAgentContext(
    (state) => state.setSessionModelWritePending
  );
  const activeModelConfig = sessionModelConfig ?? defaultModelConfig;
  const [modelChangeError, setModelChangeError] =
    useState<AgentChatOperationError | null>(null);
  const [commitModelChange] =
    useMutation<useAgentChatPanelStateUpdateAgentSessionModelMutation>(
      updateAgentSessionModelMutation
    );

  const menuValue: ModelMenuValue = useMemo(
    () => ({
      provider: activeModelConfig.provider,
      modelName: activeModelConfig.modelName ?? "",
      ...(activeModelConfig.customProvider && {
        customProvider: activeModelConfig.customProvider,
      }),
    }),
    [activeModelConfig]
  );

  const handleModelChange = useCallback(
    (model: ModelMenuValue) => {
      const nextConfig = {
        ...activeModelConfig,
        provider: model.provider,
        modelName: model.modelName,
        customProvider: model.customProvider ?? null,
      };
      // A draft has no server record yet; its selection travels with the
      // createAgentSession mutation that starts the session.
      if (!sessionId || sessionId === DRAFT_SESSION_ID) {
        setDefaultModelConfig(nextConfig);
        return;
      }
      // Render the pick immediately, then persist it. The write is marked
      // pending so a session poll already in flight — which would return the
      // pre-change model — cannot revert the selection before it lands.
      const previousConfig = activeModelConfig;
      setModelChangeError(null);
      setSessionModelConfig(sessionId, nextConfig);
      setSessionModelWritePending(sessionId, true);
      commitModelChange({
        variables: {
          input: {
            id: sessionId,
            // Derived from the next config — not the raw menu pick — so the
            // persisted selection keeps the session's existing OpenAI API
            // type and matches what the next send will assert.
            model: toAgentModelSelectionInput(
              toAgentModelSelection(nextConfig)
            ),
          },
        },
        onCompleted: () => {
          setSessionModelWritePending(sessionId, false);
        },
        onError: (error) => {
          setSessionModelConfig(sessionId, previousConfig);
          setSessionModelWritePending(sessionId, false);
          const messages = getErrorMessagesFromRelayMutationError(error);
          setModelChangeError({
            title: "Model could not be changed",
            message: messages?.[0] ?? error.message,
          });
        },
      });
    },
    [
      activeModelConfig,
      commitModelChange,
      sessionId,
      setDefaultModelConfig,
      setSessionModelConfig,
      setSessionModelWritePending,
    ]
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const clearModelChangeError = useCallback(() => {
    setModelChangeError(null);
  }, []);

  return {
    isOpen,
    position,
    menuValue,
    closePanel,
    setPosition,
    handleModelChange,
    modelChangeError,
    clearModelChangeError,
  };
}
