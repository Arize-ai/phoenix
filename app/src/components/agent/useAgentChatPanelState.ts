import { useCallback, useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";

import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { DRAFT_SESSION_ID } from "@phoenix/store/agentStore";
import type { ModelConfig } from "@phoenix/store/playground/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { ModelMenuValue } from "../generative/ModelMenu";
import type { useAgentChatPanelStatePatchAgentSessionMutation } from "./__generated__/useAgentChatPanelStatePatchAgentSessionMutation.graphql";
import {
  toAgentModelSelection,
  toAgentModelSelectionInput,
} from "./agentSessionModel";
import type { AgentChatOperationError } from "./useAgentChat";

const patchAgentSessionMutation = graphql`
  mutation useAgentChatPanelStatePatchAgentSessionMutation(
    $input: PatchAgentSessionInput!
  ) @raw_response_type {
    patchAgentSession(input: $input) {
      agentSession {
        id
        ...agentSessionModel_session
      }
    }
  }
`;

/**
 * Encapsulates the non-visual state and side effects that drive
 * {@link AgentChatPanel}.
 *
 * Responsibilities:
 * - Derives the model menu value from the session's model config
 *
 * @param params - panel state inputs
 * @param params.sessionId - the active session's Relay node ID, or the draft
 *   sentinel (or nothing) for a not-yet-persisted new-chat surface
 * @param params.sessionModelConfig - the session's persisted model resolved
 *   from Relay (see {@link useAgentSessionModelConfig}); absent for drafts,
 *   which render and persist the default model config instead
 */
export function useAgentChatPanelState({
  sessionId,
  sessionModelConfig,
}: {
  sessionId?: string | null;
  sessionModelConfig?: ModelConfig;
} = {}) {
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
  const activeModelConfig = sessionModelConfig ?? defaultModelConfig;
  const [modelChangeError, setModelChangeError] =
    useState<AgentChatOperationError | null>(null);
  const [commitModelChange] =
    useMutation<useAgentChatPanelStatePatchAgentSessionMutation>(
      patchAgentSessionMutation
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
      if (!sessionId || sessionId === DRAFT_SESSION_ID) {
        setDefaultModelConfig(nextConfig);
        return;
      }
      setModelChangeError(null);
      const selection = toAgentModelSelection(nextConfig);
      const optimisticModel =
        selection.providerType === "custom"
          ? {
              __typename: "AgentCustomProviderModelSelection" as const,
              providerId: selection.providerId,
              modelName: selection.modelName,
            }
          : {
              __typename: "AgentBuiltinProviderModelSelection" as const,
              provider: selection.provider,
              modelName: selection.modelName,
            };
      commitModelChange({
        variables: {
          input: {
            id: sessionId,
            model: toAgentModelSelectionInput(selection),
          },
        },
        optimisticResponse: {
          patchAgentSession: {
            agentSession: {
              id: sessionId,
              model: optimisticModel,
            },
          },
        },
        onError: (error) => {
          const messages = getErrorMessagesFromRelayMutationError(error);
          setModelChangeError({
            title: "Model could not be changed",
            message: messages?.[0] ?? error.message,
          });
        },
      });
    },
    [activeModelConfig, commitModelChange, sessionId, setDefaultModelConfig]
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
