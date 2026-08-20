import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  commitMutation: vi.fn(),
  fetchQuery: vi.fn(),
  graphql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

vi.mock("react-relay", () => ({
  commitMutation: relayMocks.commitMutation,
  fetchQuery: relayMocks.fetchQuery,
  graphql: relayMocks.graphql,
}));

vi.mock("@phoenix/RelayEnvironment", () => ({ default: {} }));

import {
  bindPendingPatchExperimentActions,
  buildPatchExperimentProposal,
  commitPatchExperiment,
  fetchExperimentSnapshot,
  parsePatchExperimentInput,
  type ExperimentSnapshot,
  type PendingPatchExperiment,
} from "@phoenix/agent/tools/patchExperiment";

function experimentId(rowId: string): string {
  return globalThis.btoa(`Experiment:${rowId}`);
}

const SNAPSHOT: ExperimentSnapshot = {
  name: "baseline",
  description: "first run",
  metadata: { hypothesis: "shorter prompt helps" },
  updatedAt: "2026-06-10T00:00:00Z",
};

describe("parsePatchExperimentInput", () => {
  it("accepts a valid experiment id with a sparse patch", () => {
    const parsed = parsePatchExperimentInput({
      experimentId: experimentId("1"),
      metadata: { observations: [] },
    });
    expect(parsed).toEqual({
      experimentId: experimentId("1"),
      metadata: { observations: [] },
    });
  });

  it("preserves an explicit null description to mean clear", () => {
    const parsed = parsePatchExperimentInput({
      experimentId: experimentId("1"),
      description: null,
    });
    expect(parsed).not.toBeNull();
    expect("description" in parsed!).toBe(true);
    expect(parsed!.description).toBeNull();
  });

  it("rejects a malformed experiment id, unknown keys, and a blank name", () => {
    expect(
      parsePatchExperimentInput({ experimentId: "not-a-node-id" })
    ).toBeNull();
    expect(
      parsePatchExperimentInput({
        experimentId: experimentId("1"),
        unexpected: true,
      })
    ).toBeNull();
    expect(
      parsePatchExperimentInput({ experimentId: experimentId("1"), name: "  " })
    ).toBeNull();
  });
});

describe("buildPatchExperimentProposal", () => {
  it("returns null when no field would change", () => {
    expect(
      buildPatchExperimentProposal(
        { experimentId: experimentId("1"), name: "baseline" },
        SNAPSHOT
      )
    ).toBeNull();
  });

  it("includes only changed fields and a before/after diff", () => {
    const proposal = buildPatchExperimentProposal(
      {
        experimentId: experimentId("1"),
        name: "baseline-v2",
        metadata: {
          hypothesis: "shorter prompt helps",
          observations: [{ at: "t", by: "pxi", note: "improved" }],
        },
      },
      SNAPSHOT
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.payload).toEqual({
      name: "baseline-v2",
      metadata: {
        hypothesis: "shorter prompt helps",
        observations: [{ at: "t", by: "pxi", note: "improved" }],
      },
    });
    expect(proposal!.diff.map((change) => change.field)).toEqual([
      "name",
      "metadata",
    ]);
  });

  it("treats an explicit null description against an existing one as a clear", () => {
    const proposal = buildPatchExperimentProposal(
      { experimentId: experimentId("1"), description: null },
      SNAPSHOT
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.payload).toEqual({ description: null });
  });
});

describe("fetchExperimentSnapshot", () => {
  beforeEach(() => {
    relayMocks.fetchQuery.mockReset();
  });

  it("returns the editable fields and updatedAt token", async () => {
    relayMocks.fetchQuery.mockReturnValue({
      toPromise: () =>
        Promise.resolve({
          experiment: {
            __typename: "Experiment",
            name: "baseline",
            description: null,
            metadata: { hypothesis: "x" },
            updatedAt: "2026-06-10T00:00:00Z",
          },
        }),
    });
    await expect(fetchExperimentSnapshot(experimentId("1"))).resolves.toEqual({
      name: "baseline",
      description: null,
      metadata: { hypothesis: "x" },
      updatedAt: "2026-06-10T00:00:00Z",
    });
  });

  it("throws when the node is not an experiment", async () => {
    relayMocks.fetchQuery.mockReturnValue({
      toPromise: () =>
        Promise.resolve({ experiment: { __typename: "Dataset" } }),
    });
    await expect(fetchExperimentSnapshot(experimentId("1"))).rejects.toThrow(
      "Could not resolve experimentId to an experiment."
    );
  });
});

describe("bindPendingPatchExperimentActions accept", () => {
  function makePending(): PendingPatchExperiment {
    return {
      toolCallId: "tool-call-1",
      sessionId: "session-1",
      experimentId: experimentId("1"),
      experimentName: "baseline",
      expectedUpdatedAt: SNAPSHOT.updatedAt,
      payload: { metadata: { observations: [{ at: "t", by: "pxi" }] } },
      diff: [
        {
          field: "metadata",
          previous: "{}",
          next: '{"observations":[{"at":"t","by":"pxi"}]}',
        },
      ],
    };
  }

  it("commits the stored payload verbatim when updatedAt is unchanged", async () => {
    const commitPatch = vi.fn().mockResolvedValue(undefined);
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const setPending = vi.fn();
    const pending = bindPendingPatchExperimentActions({
      pendingPatch: makePending(),
      fetchExperimentSnapshot: async () => SNAPSHOT,
      commitPatchExperiment: commitPatch,
      addToolOutput,
      setPendingPatchExperiment: setPending,
    });

    await pending.accept?.({ approvalSource: "auto" });

    expect(setPending).toHaveBeenCalledWith("tool-call-1", null);
    expect(commitPatch).toHaveBeenCalledWith({
      experimentId: experimentId("1"),
      payload: { metadata: { observations: [{ at: "t", by: "pxi" }] } },
    });
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-available",
        output: expect.objectContaining({
          status: "applied",
          acceptedBy: "auto",
          experimentName: "baseline",
        }),
      })
    );
  });

  it("rejects without committing when the experiment changed after propose", async () => {
    const commitPatch = vi.fn().mockResolvedValue(undefined);
    const addToolOutput = vi.fn().mockResolvedValue(undefined);
    const pending = bindPendingPatchExperimentActions({
      pendingPatch: makePending(),
      fetchExperimentSnapshot: async () => ({
        ...SNAPSHOT,
        updatedAt: "2026-06-11T00:00:00Z",
      }),
      commitPatchExperiment: commitPatch,
      addToolOutput,
      setPendingPatchExperiment: vi.fn(),
    });

    await pending.accept?.();

    expect(commitPatch).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        errorText: expect.stringContaining("changed after this edit"),
      })
    );
  });
});

describe("commitPatchExperiment", () => {
  beforeEach(() => {
    relayMocks.commitMutation.mockReset();
  });

  it("sends only the keys present in the payload", async () => {
    relayMocks.commitMutation.mockImplementation(
      (
        _environment: unknown,
        config: {
          onCompleted: (
            response: unknown,
            errors?: readonly { message?: string }[] | null
          ) => void;
        }
      ) => config.onCompleted({}, null)
    );

    await commitPatchExperiment({
      experimentId: experimentId("1"),
      payload: { description: null },
    });

    expect(relayMocks.commitMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: {
          input: { experimentId: experimentId("1"), description: null },
        },
      })
    );
  });
});
