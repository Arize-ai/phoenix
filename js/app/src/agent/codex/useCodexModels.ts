import { useEffect, useState } from "react";

import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

import { ensureFreshCodexAuth, listCodexModels } from "./codexAuthApi";

type CodexModelsState = {
  models: string[];
  isLoading: boolean;
  error: string | null;
};

// Module-level cache keyed by access token: the menu remounts often and the
// list rarely changes within a sign-in.
const cache = new Map<string, string[]>();

/**
 * Live model list for the browser's ChatGPT (Codex subscription) sign-in.
 * Empty (and not loading) when the browser is not signed in.
 */
export function useCodexModels(): CodexModelsState {
  const store = useAgentStore();
  const accessToken = useAgentContext(
    (state) => state.codexAuth?.accessToken ?? null
  );
  // Only failures need state: successes land in the module cache, and the
  // effect below re-renders through `version` once a fetch settles.
  const [failure, setFailure] = useState<{
    token: string;
    message: string;
  } | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!accessToken || cache.has(accessToken)) {
      return () => {};
    }
    let cancelled = false;
    void (async () => {
      try {
        const fresh = await ensureFreshCodexAuth(store);
        if (!fresh) {
          return;
        }
        const models = await listCodexModels(fresh.accessToken);
        cache.set(fresh.accessToken, models);
        if (fresh.accessToken !== accessToken) {
          // The token rotated mid-fetch; cache under the original key too so
          // the current render's lookup succeeds until the store catches up.
          cache.set(accessToken, models);
        }
        if (!cancelled) {
          setVersion((version) => version + 1);
        }
      } catch (error) {
        if (!cancelled) {
          setFailure({
            token: accessToken,
            message:
              error instanceof Error ? error.message : "Could not load models",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, store]);

  if (!accessToken) {
    return { models: [], isLoading: false, error: null };
  }
  const cached = cache.get(accessToken);
  if (cached) {
    return { models: cached, isLoading: false, error: null };
  }
  const error = failure?.token === accessToken ? failure.message : null;
  return { models: [], isLoading: error == null, error };
}
