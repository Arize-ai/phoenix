import type { SetURLSearchParams } from "react-router";

import { parseUiOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import {
  buildDatasetSelectionSnapshot,
  buildSelectionRevision,
  resolveLoadDatasetTarget,
} from "./loadPlaygroundDataset";
import { parseLoadDatasetInput } from "./parsers";
import { bindPendingLoadDatasetActions } from "./pendingLoadDataset";
import type {
  DatasetSelectionSnapshot,
  ExpectedSelection,
  PendingLoadDataset,
  ResolveDatasetTarget,
} from "./types";

// The URL (not the store) is the source of truth for the rendered dataset mode.
function getUrlSelection(searchParams: URLSearchParams): ExpectedSelection {
  return {
    datasetId: searchParams.get("datasetId"),
    splitIds: searchParams.getAll("splitId"),
  };
}

function applyDatasetSelection({
  snapshot,
  playgroundStore,
  setSearchParams,
}: {
  snapshot: DatasetSelectionSnapshot;
  playgroundStore: PlaygroundStore;
  setSearchParams: SetURLSearchParams;
}) {
  playgroundStore.getState().setDatasetId(snapshot.datasetId);
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    const hasDatasetChanged = snapshot.datasetId !== next.get("datasetId");
    next.set("datasetId", snapshot.datasetId);
    next.delete("splitId");
    snapshot.splitIds.forEach((splitId) => {
      next.append("splitId", splitId);
    });
    if (hasDatasetChanged) {
      next.delete("exampleId");
    }
    return next;
  });
}

export function createLoadDatasetClientAction({
  playgroundStore,
  setSearchParams,
  getSearchParams,
  setPendingLoadDataset,
  shouldAutoAccept = () => false,
  resolveDatasetTarget = resolveLoadDatasetTarget,
}: {
  playgroundStore: PlaygroundStore;
  setSearchParams: SetURLSearchParams;
  getSearchParams: () => URLSearchParams;
  setPendingLoadDataset: (
    toolCallId: string,
    pendingLoad: PendingLoadDataset | null
  ) => void;
  shouldAutoAccept?: () => boolean;
  resolveDatasetTarget?: ResolveDatasetTarget;
}) {
  const readSelectionRevision = () =>
    buildSelectionRevision(getUrlSelection(getSearchParams()));

  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const callContext = parseUiOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error: "Cannot propose dataset load without an operation call context.",
      };
    }
    const parsed = parseLoadDatasetInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid playground.dataset.load input." };
    }

    const resolution = await resolveDatasetTarget(parsed);
    if (!resolution.ok) return resolution;

    const expectedSelection = getUrlSelection(getSearchParams());

    // The returned promise resolves when the user (or bypass mode) decides;
    // the awaiting execute_ui script sits parked on it until then.
    return new Promise((resolve) => {
      const pendingLoad = bindPendingLoadDatasetActions({
        pendingLoad: {
          toolCallId: callContext.callId,
          sessionId: callContext.sessionId ?? "",
          input: parsed,
          snapshot: buildDatasetSelectionSnapshot(resolution.output),
          expectedSelection,
          expectedRevision: buildSelectionRevision(expectedSelection),
        },
        resolveDatasetTarget,
        readSelectionRevision,
        applyDatasetSelection: (snapshot) =>
          applyDatasetSelection({ snapshot, playgroundStore, setSearchParams }),
        emitResult: resolve,
        setPendingLoadDataset,
      });

      if (shouldAutoAccept()) {
        void pendingLoad.accept?.({ approvalSource: "auto" });
        return;
      }

      setPendingLoadDataset(callContext.callId, pendingLoad);
    });
  };
}
