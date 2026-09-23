import isEqual from "lodash/isEqual";
import { useMemo } from "react";
import { graphql, readInlineData } from "react-relay";
import { createOperationDescriptor, getRequest } from "relay-runtime";

import type { AgentModelSelection } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";
import type { ModelConfig } from "@phoenix/store/playground/types";

import { getProviderKeyForGenerativeModelSDK } from "../generative/modelProviderUtils";
import type { CustomProviderInfo } from "../generative/useModelMenuData";
import { useModelMenuData } from "../generative/useModelMenuData";
import type {
  agentSessionModel_session$data,
  agentSessionModel_session$key,
} from "./__generated__/agentSessionModel_session.graphql";
import type { agentSessionModelSessionQuery$data } from "./__generated__/agentSessionModelSessionQuery.graphql";
import type { RelayEnvironment } from "./agentSessionRelay";

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
      }
      ... on AgentCustomProviderModelSelection {
        providerId
        modelName
      }
    }
  }
`;

/**
 * Single-node read of a session's persisted model selection. Mounted with
 * `store-or-network` by resident session surfaces, so the selection is present
 * in the Relay store — and retained against garbage collection — for as long
 * as the surface can render the picker or send.
 */
export const sessionModelQuery = graphql`
  query agentSessionModelSessionQuery($id: ID!) {
    agentSession: node(id: $id) {
      __typename
      ... on AgentSession {
        id
        ...agentSessionModel_session
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
    invocationParameters: getDefaultInvocationConfig(model.provider),
  };
}

/**
 * Canonical {@link ModelConfig} → wire model selection converter. Every path
 * that asserts or persists a session's model (sends, compaction, session
 * creation, model changes) derives its selection here so the asserted model
 * can never drift from the config the UI renders.
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
    },
  };
}

/**
 * Reads a session fragment's persisted model selection in wire form, or null
 * when the data is missing or an unrecognized future variant.
 */
export function readAgentSessionModelSelectionFromFragment(
  sessionKey: agentSessionModel_session$key
): AgentModelSelection | null {
  const { model } = readInlineData(agentSessionModelFragment, sessionKey);
  if (model == null || model.__typename === "%other") {
    return null;
  }
  // The custom-provider catalog only recovers display metadata the wire form
  // discards, so an empty catalog resolves the identical selection.
  return toAgentModelSelection(
    resolvePersistedAgentModel({ model, customProviders: [] })
  );
}

/**
 * Imperatively reads a session's persisted model selection (including any
 * optimistic mutation overlay) from the Relay store, or null when the store
 * has no record for the session.
 *
 * @param params - read inputs
 * @param params.environment - Relay environment whose store to read
 * @param params.sessionId - the session's Relay node ID
 */
export function readAgentSessionModelSelection({
  environment,
  sessionId,
}: {
  environment: RelayEnvironment;
  sessionId: string;
}): AgentModelSelection | null {
  const operation = createOperationDescriptor(getRequest(sessionModelQuery), {
    id: sessionId,
  });
  const snapshot = environment.lookup(operation.fragment);
  const data = snapshot.data as unknown as
    | agentSessionModelSessionQuery$data
    | undefined;
  const agentSession = data?.agentSession;
  if (agentSession == null || agentSession.__typename !== "AgentSession") {
    return null;
  }
  return readAgentSessionModelSelectionFromFragment(agentSession);
}

/**
 * Resolves a session fragment's persisted model into the {@link ModelConfig}
 * shape the picker renders. Reactive: the key must come from a subscribed
 * Relay read (`useLazyLoadQuery`/`useFragment`), so optimistic and server
 * updates re-render through it.
 */
export function useAgentSessionModelConfig(
  sessionKey: agentSessionModel_session$key | null
): ModelConfig | undefined {
  const { customProviders } = useModelMenuData({
    fetchPolicy: "store-or-network",
  });
  return useMemo(() => {
    if (sessionKey == null) {
      return undefined;
    }
    const { model } = readInlineData(agentSessionModelFragment, sessionKey);
    if (model.__typename === "%other") {
      return undefined;
    }
    return resolvePersistedAgentModel({ model, customProviders });
  }, [customProviders, sessionKey]);
}

/**
 * Whether a model-stale (HTTP 409) rejection was another client's doing.
 *
 * A rejection can also be this client racing its own in-flight model change;
 * telling the user "another window changed the model" would be wrong there.
 * Own-change races leave a signature: either the change already landed (the
 * refetched model matches what the request asserted) or it is still in flight
 * (the optimistic overlay makes the current read differ from the refetched
 * base record). Only a rejection with neither signature is another client's.
 *
 * @param params - the three model reads around the rejection
 * @param params.assertedModel - selection the rejected request asserted
 * @param params.refetchedModel - selection the post-rejection refetch returned
 * @param params.currentModel - selection currently read from the Relay store
 *   (including any optimistic overlay), after the refetch normalized
 */
export function shouldNotifyModelChangedElsewhere({
  assertedModel,
  refetchedModel,
  currentModel,
}: {
  assertedModel: AgentModelSelection | null;
  refetchedModel: AgentModelSelection | null;
  currentModel: AgentModelSelection | null;
}): boolean {
  if (refetchedModel == null) {
    return false;
  }
  const didOwnChangeLand = isEqual(refetchedModel, assertedModel);
  const isOwnChangeInFlight = !isEqual(currentModel, refetchedModel);
  return !didOwnChangeLand && !isOwnChangeInFlight;
}
