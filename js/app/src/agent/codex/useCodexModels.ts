import { useEffect, useState } from "react";

import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

import { ensureFreshCodexAuth, listCodexModels } from "./codexAuthApi";

type CodexModelsState = {
  models: string[];
  isLoading: boolean;
  error: string | null;
};

type CodexModelsResult = {
  token: string;
  models: string[];
  error: string | null;
};

// Shared across mounts so reopening the menu does not refetch. The React
// Compiler memoizes render-time reads of this map on `accessToken`, so a
// fetch must publish its outcome through state rather than rely on a
// re-render picking up the new entry.
const cache = new Map<string, string[]>();

function cachedResult(token: string | null): CodexModelsResult | null {
  const models = token ? cache.get(token) : undefined;
  return token && models ? { token, models, error: null } : null;
}

export function useCodexModels(): CodexModelsState {
  const store = useAgentStore();
  const accessToken = useAgentContext(
    (state) => state.codexAuth?.accessToken ?? null
  );
  const [result, setResult] = useState<CodexModelsResult | null>(null);

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
        cache.set(accessToken, models);
        if (!cancelled) {
          setResult({ token: accessToken, models, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            token: accessToken,
            models: [],
            error:
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
  const resolved =
    result?.token === accessToken ? result : cachedResult(accessToken);
  if (!resolved) {
    return { models: [], isLoading: true, error: null };
  }
  return { models: resolved.models, isLoading: false, error: resolved.error };
}
