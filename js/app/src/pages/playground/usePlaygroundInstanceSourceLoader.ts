import { useEffect } from "react";

import { useNotifyError } from "@phoenix/contexts";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { PlaygroundInstanceLoadingSource } from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";
import { assertUnreachable } from "@phoenix/typeUtils";

import { fetchPlaygroundTaskInstance } from "./fetchPlaygroundTask";

function describeSource(source: PlaygroundInstanceLoadingSource): string {
  switch (source.type) {
    case "prompt":
      return "The prompt could not be loaded. It may have been deleted.";
    case "evaluator":
    case "datasetEvaluator":
      return "The evaluator could not be loaded. It may have been deleted, or it is a built-in evaluator that cannot be edited here.";
    default:
      return assertUnreachable(source);
  }
}

/**
 * Fetches whatever `loadingSource` an instance carries and lands it with
 * `loadInstance`. Mounted once per instance, so a source set by the task
 * menu or by Compare is loaded wherever the instance is rendered.
 */
export function usePlaygroundInstanceSourceLoader(instanceId: number) {
  const playgroundStore = usePlaygroundStore();
  const notifyError = useNotifyError();
  const loadingSource = usePlaygroundContext(
    (state) =>
      selectPlaygroundInstance(instanceId)(state)?.loadingSource ?? null
  );

  useEffect(() => {
    if (!loadingSource) {
      return undefined;
    }
    let isCancelled = false;
    const fail = (message: string) => {
      playgroundStore.getState().updateInstance({
        instanceId,
        patch: { loadingSource: null },
        dirty: null,
      });
      notifyError({ title: "Could not load the task", message });
    };
    fetchPlaygroundTaskInstance(loadingSource)
      .then((loaded) => {
        if (isCancelled) {
          return;
        }
        if (loaded) {
          playgroundStore
            .getState()
            .loadInstance({ instanceId, instance: loaded.instance });
        } else {
          fail(describeSource(loadingSource));
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          fail(
            error instanceof Error
              ? error.message
              : describeSource(loadingSource)
          );
        }
      });
    return () => {
      // A newer source, or a removed instance, owns the result now.
      isCancelled = true;
    };
  }, [loadingSource, instanceId, playgroundStore, notifyError]);
}
