import { useEffect, useRef, useState } from "react";
import { graphql, useMutation } from "react-relay";

import type { AgentModelSelection } from "@phoenix/components/agent/useGenerateSessionSummary";

import type {
  OpenAIApiType,
  useAgentModelWebSearchSupportMutation,
} from "./__generated__/useAgentModelWebSearchSupportMutation.graphql";

/**
 * Map the REST `openaiApiType` value (snake_case) onto the GraphQL
 * `OpenAIApiType` enum (member names). The two surfaces describe the same
 * concept with different serializations.
 */
const OPENAI_API_TYPE_TO_GRAPHQL: Record<
  "chat_completions" | "responses",
  OpenAIApiType
> = {
  chat_completions: "CHAT_COMPLETIONS",
  responses: "RESPONSES",
};

/**
 * Resolution state of a model's provider-native web search support.
 *
 * - `loading`: the capability is being resolved for the current selection.
 * - `supported`: the model exposes provider-native web search.
 * - `unsupported`: the model does not support web search (or its
 *   capabilities could not be resolved, e.g. missing credentials).
 */
export type WebSearchSupport = "loading" | "supported" | "unsupported";

const agentModelCapabilitiesMutation = graphql`
  mutation useAgentModelWebSearchSupportMutation(
    $model: AgentModelSelectionInput!
  ) {
    agentModelCapabilities(model: $model) {
      supportsWebSearch
    }
  }
`;

/**
 * Convert the chat `AgentModelSelection` (REST/transport shape) into the
 * `AgentModelSelectionInput` GraphQL `@oneOf` input.
 */
function toModelSelectionInput(
  modelSelection: AgentModelSelection
): useAgentModelWebSearchSupportMutation["variables"]["model"] {
  if (modelSelection.providerType === "custom") {
    return {
      custom: {
        providerId: modelSelection.providerId,
        modelName: modelSelection.modelName,
      },
    };
  }
  return {
    builtin: {
      provider: modelSelection.provider,
      modelName: modelSelection.modelName,
      ...(modelSelection.openaiApiType
        ? {
            openaiApiType:
              OPENAI_API_TYPE_TO_GRAPHQL[modelSelection.openaiApiType],
          }
        : {}),
    },
  };
}

/**
 * Resolves whether the selected agent model supports provider-native web
 * search, re-querying whenever the selection changes.
 *
 * Backed by the `agentModelCapabilities` mutation (a mutation rather than a
 * query because resolving capabilities decrypts provider secrets). Stale
 * in-flight responses are discarded when the selection changes again.
 *
 * Pass `enabled: false` to skip the request entirely (e.g. when web search is
 * hidden because it is unavailable or globally disabled); the hook then stays
 * in the `loading` state without issuing a mutation.
 */
export function useAgentModelWebSearchSupport(
  modelSelection: AgentModelSelection,
  { enabled = true }: { enabled?: boolean } = {}
): WebSearchSupport {
  const [support, setSupport] = useState<WebSearchSupport>("loading");
  const [commit] = useMutation<useAgentModelWebSearchSupportMutation>(
    agentModelCapabilitiesMutation
  );

  // A stable signature of the current selection so the effect only refires
  // when the meaningful inputs change.
  const selectionSignature = JSON.stringify(modelSelection);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const requestId = ++latestRequestRef.current;
    setSupport("loading");
    commit({
      variables: { model: toModelSelectionInput(modelSelection) },
      onCompleted: (response) => {
        if (latestRequestRef.current !== requestId) return;
        setSupport(
          response.agentModelCapabilities.supportsWebSearch
            ? "supported"
            : "unsupported"
        );
      },
      onError: () => {
        if (latestRequestRef.current !== requestId) return;
        setSupport("unsupported");
      },
    });
    // `selectionSignature` captures the relevant fields of `modelSelection`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionSignature, commit, enabled]);

  return support;
}
