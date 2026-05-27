import { useEffect, useMemo } from "react";
import { useMatches, useSearchParams } from "react-router";

import { createCreateCodeEvaluatorClientAction } from "@phoenix/agent/tools/codeEvaluatorDraft";
import { CREATE_CODE_EVALUATOR_TOOL_NAME } from "@phoenix/agent/tools/createCodeEvaluator";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { deriveRouteContexts } from "./deriveRouteContexts";

/**
 * Headless component that mirrors the current route (matches + search params)
 * into the agent store's `routeContexts` slice.
 *
 * Mounted once near the root so every navigation refreshes the contexts
 * advertised to the chat agent. Renders nothing; pair with
 * {@link ./useAdvertiseAgentContext.useAdvertiseAgentContext} for
 * feature-level contexts that cannot be derived from the route alone.
 *
 * Also registers the `create_code_evaluator` client action here so the
 * create-proposal flow works on any surface — including dataset surfaces
 * where no code-evaluator form is mounted.
 */
export function AgentContextSync() {
  const store = useAgentStore();
  const matches = useMatches();
  const [searchParams] = useSearchParams();

  const next = useMemo(
    () => deriveRouteContexts(matches, searchParams),
    [matches, searchParams]
  );

  useEffect(() => {
    store.getState().setRouteContexts(next);
  }, [next, store]);

  useEffect(() => {
    const {
      registerClientAction,
      unregisterClientAction,
      setPendingCodeEvaluatorCreate,
    } = store.getState();
    registerClientAction(
      CREATE_CODE_EVALUATOR_TOOL_NAME,
      createCreateCodeEvaluatorClientAction({
        store,
        setPendingCodeEvaluatorCreate,
      })
    );
    return () => {
      unregisterClientAction(CREATE_CODE_EVALUATOR_TOOL_NAME);
      for (const pending of Object.values(
        store.getState().pendingCodeEvaluatorCreatesByToolCallId
      )) {
        if (pending) {
          void pending.cancel?.();
        }
      }
    };
  }, [store]);

  return null;
}
