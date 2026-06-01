import type { SetURLSearchParams } from "react-router";

import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import {
  buildDatasetSelectionSnapshot,
  buildSelectionRevision,
  resolveLoadDatasetTarget,
} from "./loadPlaygroundDataset";
import {
  parseLoadDatasetActionContext,
  parseLoadDatasetInput,
} from "./parsers";
import { bindPendingLoadDatasetActions } from "./pendingLoadDataset";
import type {
  DatasetSelectionSnapshot,
  ExpectedSelection,
  PendingLoadDataset,
  ResolveDatasetTarget,
} from "./types";

/**
 * Reads the live playground dataset selection from the URL search params. The
 * URL — not the store — is the source of truth for the rendered dataset mode,
 * so drift detection must read it too.
 */
function getUrlSelection(searchParams: URLSearchParams): ExpectedSelection {
  return {
    datasetId: searchParams.get("datasetId"),
    splitIds: searchParams.getAll("splitId"),
  };
}

/**
 * Applies a selection by replicating PlaygroundDatasetSelect.onSelectionChange:
 * write the store (keeps the experiment path + per-dataset config consistent)
 * and the URL (flips the visible mode), setting `datasetId` + one repeated
 * `splitId` per split and clearing the now-stale `exampleId`.
 */
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

/**
 * Creates the client action handler for the load_dataset tool. At propose time
 * it resolves the dataset/split names to ids, validates existence + emptiness,
 * snapshots the selection with a drift revision, and registers a pending
 * proposal for user approval before the playground switches into dataset mode.
 */
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
  /** Reads the current URL search params (kept fresh across renders). */
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
    const actionContext = parseLoadDatasetActionContext(context);
    if (!actionContext) {
      return {
        ok: false,
        error: "Cannot propose dataset load without tool call context.",
      };
    }
    const parsed = parseLoadDatasetInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid load_dataset input." };
    }

    const resolution = await resolveDatasetTarget(parsed);
    if (!resolution.ok) return resolution;

    const expectedSelection = getUrlSelection(getSearchParams());
    const pendingLoad = bindPendingLoadDatasetActions({
      pendingLoad: {
        toolCallId: actionContext.toolCallId,
        sessionId: actionContext.sessionId,
        input: parsed,
        snapshot: buildDatasetSelectionSnapshot(resolution.output),
        expectedSelection,
        expectedRevision: buildSelectionRevision(expectedSelection),
      },
      resolveDatasetTarget,
      readSelectionRevision,
      applyDatasetSelection: (snapshot) =>
        applyDatasetSelection({ snapshot, playgroundStore, setSearchParams }),
      addToolOutput: actionContext.addToolOutput,
      setPendingLoadDataset,
    });

    if (shouldAutoAccept()) {
      await pendingLoad.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingLoadDataset(actionContext.toolCallId, pendingLoad);
    return { ok: true };
  };
}
