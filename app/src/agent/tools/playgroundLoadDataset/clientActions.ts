import type { SetURLSearchParams } from "react-router";

import type { PendingApproval } from "@phoenix/agent/shared/pendingApproval";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { LOAD_DATASET_TOOL_NAME } from "./constants";
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
  setPendingApproval,
  clearPendingApproval,
  shouldAutoAccept = () => false,
  resolveDatasetTarget = resolveLoadDatasetTarget,
}: {
  playgroundStore: PlaygroundStore;
  setSearchParams: SetURLSearchParams;
  getSearchParams: () => URLSearchParams;
  setPendingApproval: (toolCallId: string, pending: PendingApproval) => void;
  clearPendingApproval: (toolCallId: string) => void;
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
        toolName: LOAD_DATASET_TOOL_NAME,
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
      clearPending: clearPendingApproval,
    });

    if (shouldAutoAccept()) {
      await pendingLoad.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingApproval(actionContext.toolCallId, pendingLoad);
    return { ok: true };
  };
}
