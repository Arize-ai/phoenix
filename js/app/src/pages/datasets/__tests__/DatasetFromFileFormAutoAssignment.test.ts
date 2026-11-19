import { computeAutoAssignment } from "../DatasetFromFileForm";

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
  const formats = [
    { format: "CSV", columns: CSV_COLUMNS, rows: csvRows },
    { format: "JSONL", columns: JSONL_COLUMNS, rows: jsonlRows },
  ];

  it.each(formats)(
    "skips a $format id of node IDs in create mode but keeps one of external IDs",
    ({ columns, rows }) => {
      const exampleIdKeyFor = (ids: string[]) =>
        computeAutoAssignment({
          columns,
          previewRows: rows(ids),
          mode: "create",
        }).exampleIdKey;
      expect(exampleIdKeyFor([nodeId(1), nodeId(2), nodeId(3)])).toBeNull();
      expect(exampleIdKeyFor(["ext-1", nodeId(2), "ext-3"])).toBeNull();
      expect(exampleIdKeyFor(["ext-1", "ext-2", "ext-3"])).toBe("id");
    }
  );

  it.each(formats)(
    "keeps a $format id of node IDs in append mode only",
    ({ columns, rows }) => {
      const previewRows = rows([nodeId(1), nodeId(2), nodeId(3)]);
      expect(
        computeAutoAssignment({ columns, previewRows, mode: "create" })
          .exampleIdKey
      ).toBeNull();
      expect(
        computeAutoAssignment({ columns, previewRows, mode: "append" })
          .exampleIdKey
      ).toBe("id");
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
