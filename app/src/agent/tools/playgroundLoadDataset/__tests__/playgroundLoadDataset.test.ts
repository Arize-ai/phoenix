import { createSearchParams, type SetURLSearchParams } from "react-router";

import {
  buildDatasetSelectionSnapshot,
  buildSelectionRevision,
  createLoadDatasetClientAction,
  parseLoadDatasetInput,
  type DatasetTargetResolution,
  type PendingLoadDataset,
  type ResolveDatasetTarget,
} from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

// Mutable URL-search-params harness; `setDrift` reassigns params to simulate selection drift.
function createSearchParamsHarness(initial?: string) {
  let params = new URLSearchParams(initial);
  const setSearchParams = vi.fn<SetURLSearchParams>((next) => {
    const resolved = typeof next === "function" ? next(params) : next;
    params = createSearchParams(resolved);
  });
  return {
    getSearchParams: () => params,
    setSearchParams,
    setDrift: (search: string) => {
      params = new URLSearchParams(search);
    },
  };
}

// Some jsdom configs expose an opaque-origin localStorage with no `setItem`; shim it
// so the store dual-write (which persists to localStorage) is hermetic.
function ensureWorkingLocalStorage() {
  if (typeof window.localStorage?.setItem === "function") {
    return;
  }
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  });
}

const toolCallContext = {
  toolCallId: "call-1",
  sessionId: "session-1",
  addToolOutput: vi.fn().mockResolvedValue(undefined),
};

function resolverFor(
  resolution: DatasetTargetResolution
): ResolveDatasetTarget {
  return vi.fn().mockResolvedValue(resolution);
}

describe("playground load dataset agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
    vi.clearAllMocks();
    ensureWorkingLocalStorage();
  });

  it("parses common load_dataset input aliases", () => {
    expect(
      parseLoadDatasetInput({
        dataset_name: "Support Tickets",
        split_name: "train",
      })
    ).toEqual({ datasetName: "Support Tickets", splitName: "train" });
  });

  it("requires a non-empty dataset name", () => {
    expect(parseLoadDatasetInput({})).toBeNull();
    expect(parseLoadDatasetInput({ datasetName: "   " })).toBeNull();
  });

  it("treats a null split name as loading the whole dataset", () => {
    expect(
      parseLoadDatasetInput({ datasetName: "Support", splitName: null })
    ).toEqual({ datasetName: "Support" });
  });

  it("derives a revision independent of split ordering", () => {
    expect(
      buildSelectionRevision({ datasetId: "d1", splitIds: ["a", "b"] })
    ).toEqual(
      buildSelectionRevision({ datasetId: "d1", splitIds: ["b", "a"] })
    );
    expect(
      buildSelectionRevision({ datasetId: "d1", splitIds: ["a"] })
    ).not.toEqual(buildSelectionRevision({ datasetId: "d2", splitIds: ["a"] }));
  });

  it("snapshots only the selected split id and names", () => {
    expect(
      buildDatasetSelectionSnapshot({
        datasetId: "d1",
        datasetName: "Support",
        splitId: "s1",
        splitName: "train",
      })
    ).toEqual({
      datasetId: "d1",
      splitIds: ["s1"],
      datasetName: "Support",
      splitNames: ["train"],
    });
    expect(
      buildDatasetSelectionSnapshot({
        datasetId: "d1",
        datasetName: "Support",
        splitId: null,
        splitName: null,
      })
    ).toEqual({ datasetId: "d1", splitIds: [], datasetName: "Support" });
  });

  it("surfaces propose-time resolution errors and registers no pending load", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const setPendingLoadDataset =
      vi.fn<
        (toolCallId: string, pendingLoad: PendingLoadDataset | null) => void
      >();
    const harness = createSearchParamsHarness();
    const action = createLoadDatasetClientAction({
      playgroundStore,
      setSearchParams: harness.setSearchParams,
      getSearchParams: harness.getSearchParams,
      setPendingLoadDataset,
      resolveDatasetTarget: resolverFor({
        ok: false,
        error: 'No dataset named "Ghost" was found.',
      }),
    });

    const result = await action({ datasetName: "Ghost" }, toolCallContext);

    expect(result).toEqual({
      ok: false,
      error: 'No dataset named "Ghost" was found.',
    });
    expect(setPendingLoadDataset).not.toHaveBeenCalled();
  });

  it("registers a pending load and dual-writes store + URL on accept", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const setPendingLoadDataset =
      vi.fn<
        (toolCallId: string, pendingLoad: PendingLoadDataset | null) => void
      >();
    const harness = createSearchParamsHarness("exampleId=ex-old");
    const action = createLoadDatasetClientAction({
      playgroundStore,
      setSearchParams: harness.setSearchParams,
      getSearchParams: harness.getSearchParams,
      setPendingLoadDataset,
      resolveDatasetTarget: resolverFor({
        ok: true,
        output: {
          datasetId: "d1",
          datasetName: "Support",
          splitId: "s1",
          splitName: "train",
        },
      }),
    });

    await action(
      { datasetName: "Support", splitName: "train" },
      toolCallContext
    );

    expect(setPendingLoadDataset).toHaveBeenCalledTimes(1);
    const pendingLoad = setPendingLoadDataset.mock.calls[0]![1]!;
    expect(pendingLoad.snapshot).toEqual({
      datasetId: "d1",
      splitIds: ["s1"],
      datasetName: "Support",
      splitNames: ["train"],
    });

    await pendingLoad.accept?.();

    // Pending state cleared before the write.
    expect(setPendingLoadDataset).toHaveBeenLastCalledWith("call-1", null);
    // Store write flips dataset mode for the experiment path.
    expect(playgroundStore.getState().datasetId).toBe("d1");
    // URL write sets datasetId + repeated splitId and clears the stale exampleId.
    const written = harness.getSearchParams();
    expect(written.get("datasetId")).toBe("d1");
    expect(written.getAll("splitId")).toEqual(["s1"]);
    expect(written.get("exampleId")).toBeNull();
    expect(toolCallContext.addToolOutput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "output-available",
        tool: "load_dataset",
        toolCallId: "call-1",
        output: expect.objectContaining({ status: "loaded", datasetId: "d1" }),
      })
    );
  });

  it("rejects on accept when the selection drifted since propose", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const setPendingLoadDataset =
      vi.fn<
        (toolCallId: string, pendingLoad: PendingLoadDataset | null) => void
      >();
    const harness = createSearchParamsHarness();
    const resolveDatasetTarget = resolverFor({
      ok: true,
      output: {
        datasetId: "d1",
        datasetName: "Support",
        splitId: null,
        splitName: null,
      },
    });
    const action = createLoadDatasetClientAction({
      playgroundStore,
      setSearchParams: harness.setSearchParams,
      getSearchParams: harness.getSearchParams,
      setPendingLoadDataset,
      resolveDatasetTarget,
    });

    await action({ datasetName: "Support" }, toolCallContext);
    const pendingLoad = setPendingLoadDataset.mock.calls[0]![1]!;

    // The user picked a different dataset after the proposal.
    harness.setDrift("datasetId=other");
    await pendingLoad.accept?.();

    expect(harness.setSearchParams).not.toHaveBeenCalled();
    expect(playgroundStore.getState().datasetId).toBeNull();
    expect(toolCallContext.addToolOutput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: "load_dataset",
        errorText: expect.stringContaining("selection changed"),
      })
    );
  });

  it("rejects on accept when the target no longer resolves", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const setPendingLoadDataset =
      vi.fn<
        (toolCallId: string, pendingLoad: PendingLoadDataset | null) => void
      >();
    const harness = createSearchParamsHarness();
    const resolveDatasetTarget = vi
      .fn<ResolveDatasetTarget>()
      .mockResolvedValueOnce({
        ok: true,
        output: {
          datasetId: "d1",
          datasetName: "Support",
          splitId: null,
          splitName: null,
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: 'No dataset named "Support" was found.',
      });
    const action = createLoadDatasetClientAction({
      playgroundStore,
      setSearchParams: harness.setSearchParams,
      getSearchParams: harness.getSearchParams,
      setPendingLoadDataset,
      resolveDatasetTarget,
    });

    await action({ datasetName: "Support" }, toolCallContext);
    const pendingLoad = setPendingLoadDataset.mock.calls[0]![1]!;

    await pendingLoad.accept?.();

    expect(resolveDatasetTarget).toHaveBeenCalledTimes(2);
    expect(harness.setSearchParams).not.toHaveBeenCalled();
    expect(toolCallContext.addToolOutput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: "load_dataset",
        errorText: 'No dataset named "Support" was found.',
      })
    );
  });

  it("auto-accepts when shouldAutoAccept is true", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const setPendingLoadDataset =
      vi.fn<
        (toolCallId: string, pendingLoad: PendingLoadDataset | null) => void
      >();
    const harness = createSearchParamsHarness();
    const action = createLoadDatasetClientAction({
      playgroundStore,
      setSearchParams: harness.setSearchParams,
      getSearchParams: harness.getSearchParams,
      setPendingLoadDataset,
      shouldAutoAccept: () => true,
      resolveDatasetTarget: resolverFor({
        ok: true,
        output: {
          datasetId: "d1",
          datasetName: "Support",
          splitId: null,
          splitName: null,
        },
      }),
    });

    await action({ datasetName: "Support" }, toolCallContext);

    expect(playgroundStore.getState().datasetId).toBe("d1");
    expect(toolCallContext.addToolOutput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          status: "loaded",
          acceptedBy: "auto",
        }),
      })
    );
  });
});
