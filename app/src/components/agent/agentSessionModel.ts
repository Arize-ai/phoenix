import { graphql, readInlineData } from "react-relay";

import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";
import type { AgentState } from "@phoenix/store/agentStore";
import type { ModelConfig } from "@phoenix/store/playground/types";

import { getProviderKeyForGenerativeModelSDK } from "../generative/modelProviderUtils";
import type { CustomProviderInfo } from "../generative/useModelMenuData";
import type {
  agentSessionModel_session$data,
  agentSessionModel_session$key,
} from "./__generated__/agentSessionModel_session.graphql";

/**
 * The session's persisted model selection, shared by every document that reads
 * or writes an `AgentSession`. `@inline` keeps the selection readable from
 * imperative code (polls, mutation callbacks) via {@link readInlineData}.
 */
const agentSessionModelFragment = graphql`
  fragment agentSessionModel_session on AgentSession @inline {
    model {
      __typename
      ... on AgentBuiltinProviderModelSelection {
        provider
        modelName
        openaiApiType
      }
      ... on AgentCustomProviderModelSelection {
        providerId
        modelName
      }
    }
  }
`;

/** A session's server-persisted model selection, minus Relay's `%other` arm. */
export type PersistedAgentModel = Exclude<
  agentSessionModel_session$data["model"],
  { __typename: "%other" }
>;

/**
 * Rebuilds a store {@link ModelConfig} from a session's persisted model.
 *
 * @param params - resolution inputs
 * @param params.model - the session's persisted model selection
 * @param params.customProviders - live custom provider catalog, used to
 *   recover a custom selection's provider SDK and display name
 */
export function resolvePersistedAgentModel({
  model,
  customProviders,
}: {
  model: PersistedAgentModel;
  customProviders: readonly CustomProviderInfo[];
}): ModelConfig {
  if (model.__typename === "AgentCustomProviderModelSelection") {
    const customProvider = customProviders.find(
      (provider) => provider.id === model.providerId
    );
    const provider = customProvider
      ? getProviderKeyForGenerativeModelSDK(customProvider.sdk)
      : "OPENAI";
    return {
      provider,
      modelName: model.modelName,
      customProvider: {
        id: model.providerId,
        name: customProvider?.name ?? "Deleted provider",
      },
      invocationParameters: getDefaultInvocationConfig(provider),
    };
  }
  return {
    provider: model.provider,
    modelName: model.modelName,
    openaiApiType: model.openaiApiType,
    invocationParameters: getDefaultInvocationConfig(model.provider),
  };
}

/**
 * Applies a session's server-persisted model selection to the store.
 *
 * @param params - seeding inputs
 * @param params.session - fragment ref of the session read from the server
 * @param params.sessionId - the session's Relay node ID
 * @param params.customProviders - live custom provider catalog
 * @param params.state - store state owning the guarded model write
 */
export function applyPersistedAgentSessionModel({
  session,
  sessionId,
  customProviders,
  state,
}: {
  session: agentSessionModel_session$key;
  sessionId: string;
  customProviders: readonly CustomProviderInfo[];
  state: Pick<AgentState, "applyServerSessionModelConfig">;
}): void {
  const { model } = readInlineData(agentSessionModelFragment, session);
  if (model.__typename === "%other") {
    return;
  }
  state.applyServerSessionModelConfig(
    sessionId,
    resolvePersistedAgentModel({ model, customProviders })
  );
}
