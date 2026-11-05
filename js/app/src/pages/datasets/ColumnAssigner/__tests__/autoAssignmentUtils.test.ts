import { computeAutoAssignment } from "../autoAssignmentUtils";

const nodeId = (n: number) => btoa(`DatasetExample:${n}`);

// The header of a Phoenix CSV export (`GET /v1/datasets/{id}/csv`): `id` is
// the external ID, or the DatasetExample GlobalID when the example has none.
const CSV_COLUMNS = [
  "id",
  "node_id",
  "input.question",
  "output.answer",
  "splits",
];

function csvRows(ids: string[]): string[][] {
  return ids.map((id, i) => [
    id,
    nodeId(i + 1),
    `question ${i}`,
    `answer ${i}`,
    '["train"]',
  ]);
}

// The keys of a Phoenix JSONL export (`GET /v1/datasets/{id}/jsonl`).
const JSONL_COLUMNS = [
  "id",
  "node_id",
  "input",
  "output",
  "metadata",
  "splits",
];

function jsonlRows(ids: string[]): Record<string, unknown>[] {
  return ids.map((id, i) => ({
    id,
    node_id: nodeId(i + 1),
    input: { question: `question ${i}` },
    output: { answer: `answer ${i}` },
    metadata: {},
    splits: ["train"],
  }));
}

describe("computeAutoAssignment", () => {
  it.each([
    {
      scenario: "CSV id column holds node IDs in create mode",
      columns: CSV_COLUMNS,
      previewRows: csvRows([nodeId(1), nodeId(2), nodeId(3)]),
      mode: "create" as const,
      exampleIdKey: null,
    },
    {
      scenario: "CSV id column mixes external and node IDs in create mode",
      columns: CSV_COLUMNS,
      previewRows: csvRows(["ext-1", nodeId(2), "ext-3"]),
      mode: "create" as const,
      exampleIdKey: null,
    },
    {
      scenario: "CSV id column holds external IDs in create mode",
      columns: CSV_COLUMNS,
      previewRows: csvRows(["ext-1", "ext-2", "ext-3"]),
      mode: "create" as const,
      exampleIdKey: "id",
    },
    {
      scenario: "CSV id column holds node IDs in append mode",
      columns: CSV_COLUMNS,
      previewRows: csvRows([nodeId(1), nodeId(2), nodeId(3)]),
      mode: "append" as const,
      exampleIdKey: "id",
    },
    {
      scenario: "JSONL id field holds node IDs in create mode",
      columns: JSONL_COLUMNS,
      previewRows: jsonlRows([nodeId(1), nodeId(2), nodeId(3)]),
      mode: "create" as const,
      exampleIdKey: null,
    },
    {
      scenario: "JSONL id field holds external IDs in create mode",
      columns: JSONL_COLUMNS,
      previewRows: jsonlRows(["ext-1", "ext-2", "ext-3"]),
      mode: "create" as const,
      exampleIdKey: "id",
    },
    {
      scenario: "JSONL id field holds node IDs in append mode",
      columns: JSONL_COLUMNS,
      previewRows: jsonlRows([nodeId(1), nodeId(2), nodeId(3)]),
      mode: "append" as const,
      exampleIdKey: "id",
    },
  ])(
    "selects exampleIdKey $exampleIdKey when the $scenario",
    ({ columns, previewRows, mode, exampleIdKey }) => {
      expect(
        computeAutoAssignment({ columns, previewRows, mode }).exampleIdKey
      ).toBe(exampleIdKey);
    }
  );

  it("falls through to the next ID-named column when the first holds node IDs", () => {
    const result = computeAutoAssignment({
      columns: ["id", "example_id", "input"],
      previewRows: [
        [nodeId(1), "ext-1", "question 1"],
        [nodeId(2), "ext-2", "question 2"],
      ],
      mode: "create",
    });
    expect(result.exampleIdKey).toBe("example_id");
  });

  it("still assigns the other buckets of an export", () => {
    const result = computeAutoAssignment({
      columns: CSV_COLUMNS,
      previewRows: csvRows([nodeId(1)]),
      mode: "create",
    });
    expect(result).toEqual({
      input: ["input.question"],
      output: ["output.answer"],
      metadata: [],
      splitKey: "splits",
      exampleIdKey: null,
    });
  });
});
