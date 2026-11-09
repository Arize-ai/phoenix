import { describe, expect, it } from "vitest";

import type { EditableTableDiff } from "@phoenix/types/table";

import {
  getNewPlaygroundExampleTemplate,
  type PlaygroundEditableExampleRow,
  restoreHiddenMetadata,
  toEditableMetadata,
} from "../playgroundExampleEditing";

const annotations = { judge: { label: "pass" } };

function row(
  overrides: Partial<PlaygroundEditableExampleRow>
): PlaygroundEditableExampleRow {
  return {
    id: "ex1",
    externalId: null,
    input: {},
    output: {},
    metadata: {},
    hiddenMetadata: null,
    isNew: false,
    ...overrides,
  };
}

describe("toEditableMetadata", () => {
  it("keeps the annotations aside while they are hidden", () => {
    expect(
      toEditableMetadata(
        { source: "seed", annotations },
        { hideAnnotations: true }
      )
    ).toEqual({
      metadata: { source: "seed" },
      hiddenMetadata: { annotations },
    });
  });

  it("edits the whole metadata when nothing is hidden", () => {
    expect(
      toEditableMetadata(
        { source: "seed", annotations },
        { hideAnnotations: false }
      )
    ).toEqual({
      metadata: { source: "seed", annotations },
      hiddenMetadata: null,
    });
    expect(
      toEditableMetadata({ source: "seed" }, { hideAnnotations: true })
    ).toEqual({ metadata: { source: "seed" }, hiddenMetadata: null });
  });

  it("falls back to an empty object for metadata that is not one", () => {
    expect(toEditableMetadata(null, { hideAnnotations: true })).toEqual({
      metadata: {},
      hiddenMetadata: null,
    });
  });
});

describe("restoreHiddenMetadata", () => {
  const rowsById = new Map([
    [
      "ex1",
      row({ metadata: { source: "seed" }, hiddenMetadata: { annotations } }),
    ],
    ["ex2", row({ id: "ex2" })],
  ]);

  it("puts the hidden annotations back under an edited metadata", () => {
    const diff: EditableTableDiff<PlaygroundEditableExampleRow> = {
      addedRows: [],
      deletedRowIds: [],
      updatedRows: [
        { rowId: "ex1", changes: { metadata: { source: "edited" } } },
        { rowId: "ex2", changes: { metadata: { source: "edited" } } },
        { rowId: "ex1", changes: { input: { q: 1 } } },
      ],
    };

    expect(restoreHiddenMetadata(diff, rowsById).updatedRows).toEqual([
      {
        rowId: "ex1",
        changes: { metadata: { source: "edited", annotations } },
      },
      { rowId: "ex2", changes: { metadata: { source: "edited" } } },
      { rowId: "ex1", changes: { input: { q: 1 } } },
    ]);
  });

  it("lets an edit that writes the key itself win", () => {
    const diff: EditableTableDiff<PlaygroundEditableExampleRow> = {
      addedRows: [],
      deletedRowIds: [],
      updatedRows: [
        { rowId: "ex1", changes: { metadata: { annotations: {} } } },
      ],
    };

    expect(
      restoreHiddenMetadata(diff, rowsById).updatedRows[0].changes
    ).toEqual({ metadata: { annotations: {} } });
  });
});

describe("getNewPlaygroundExampleTemplate", () => {
  it("blanks the first saved example's shape and leaves the annotations out", () => {
    expect(
      getNewPlaygroundExampleTemplate([
        row({ isNew: true, input: { draft: "x" } }),
        row({
          input: { question: "q", context: { region: 1 } },
          output: { answer: "a" },
          metadata: { source: "seed", annotations },
        }),
      ])
    ).toEqual({
      input: { question: "", context: { region: 0 } },
      output: { answer: "" },
      metadata: { source: "" },
    });
  });
});
