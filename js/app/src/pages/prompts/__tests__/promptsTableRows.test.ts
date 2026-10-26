import type { PromptsTableNode } from "../promptsTableRows";
import { toPromptsTableRows } from "../promptsTableRows";

const common = {
  description: "",
  createdBy: null,
  updatedBy: null,
  versionCount: 1,
  labels: [],
};

describe("toPromptsTableRows", () => {
  it("normalizes prompts and decisions into one row shape, in order", () => {
    const nodes: PromptsTableNode[] = [
      {
        ...common,
        __typename: "Decision",
        id: "D1",
        name: "triage",
        updatedAt: "2026-01-02T00:00:00Z",
        latestVersion: {
          id: "DV1",
          createdAt: "2026-01-03T00:00:00Z",
          modelName: "jev",
          modelProvider: "TYPESAFE",
        },
        versionTags: [
          { id: "T1", name: "production", decisionVersionId: "DV1" },
        ],
      },
      {
        ...common,
        __typename: "Prompt",
        id: "P1",
        name: "support",
        version: {
          id: "PV1",
          createdAt: "2026-01-01T00:00:00Z",
          modelName: "gpt-4o",
          modelProvider: "OPENAI",
        },
        versionTags: [{ id: "T2", name: "staging", promptVersionId: "PV1" }],
      },
    ];
    const rows = toPromptsTableRows(nodes);
    expect(rows.map((row) => [row.kind, row.id])).toEqual([
      ["decision", "D1"],
      ["prompt", "P1"],
    ]);
    expect(rows[0]).toMatchObject({
      description: null,
      modelName: "jev",
      latestVersionId: "DV1",
      lastUpdatedAt: "2026-01-03T00:00:00Z",
      versionTags: [{ id: "T1", name: "production", versionId: "DV1" }],
    });
    expect(rows[1]).toMatchObject({
      modelName: "gpt-4o",
      modelProvider: "OPENAI",
      latestVersionId: "PV1",
      versionTags: [{ id: "T2", name: "staging", versionId: "PV1" }],
    });
  });

  it("falls back to the decision's update time when it has no version", () => {
    const [row] = toPromptsTableRows([
      {
        ...common,
        __typename: "Decision",
        id: "D2",
        name: "empty",
        updatedAt: "2026-02-01T00:00:00Z",
        latestVersion: null,
        versionTags: [],
      },
    ]);
    expect(row).toMatchObject({
      kind: "decision",
      modelName: null,
      modelProvider: null,
      latestVersionId: null,
      lastUpdatedAt: "2026-02-01T00:00:00Z",
    });
  });

  it("omits a provider the app has no icon for and skips unknown node types", () => {
    const rows = toPromptsTableRows([
      {
        ...common,
        __typename: "Decision",
        id: "D3",
        name: "custom",
        updatedAt: "2026-02-01T00:00:00Z",
        latestVersion: {
          id: "DV3",
          createdAt: "2026-02-02T00:00:00Z",
          modelName: "m",
          modelProvider: "NOT_A_PROVIDER",
        },
        versionTags: [],
      },
      { __typename: "%other" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].modelProvider).toBeNull();
  });
});
