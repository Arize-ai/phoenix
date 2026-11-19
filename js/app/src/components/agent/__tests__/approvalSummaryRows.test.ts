import { describe, expect, it } from "vitest";

import { payloadToApprovalSummaryRows } from "../ApprovalCard";

describe("payloadToApprovalSummaryRows", () => {
  it("renders scalars and primitive arrays inline", () => {
    expect(
      payloadToApprovalSummaryRows({
        datasetName: "support-triage",
        exampleCount: 3,
        splitNames: ["train", "test"],
      })
    ).toEqual([
      { label: "dataset name", value: "support-triage" },
      { label: "example count", value: "3" },
      { label: "split names", value: "train, test" },
    ]);
  });

  it("fans arrays of objects out one row per element with dot-path lines", () => {
    const rows = payloadToApprovalSummaryRows({
      examples: [
        {
          input: { message: "The setup was confusing at first." },
          output: { label: "positive" },
          metadata: { channel: "chat", difficulty: "hard", annotations: {} },
        },
        {
          input: { message: "Second example." },
          output: { label: "negative" },
        },
      ],
    });
    expect(rows).toEqual([
      {
        label: "examples 1",
        value: [
          "input.message: The setup was confusing at first.",
          "output.label: positive",
          "metadata.channel: chat",
          "metadata.difficulty: hard",
        ].join("\n"),
      },
      {
        label: "examples 2",
        value: [
          "input.message: Second example.",
          "output.label: negative",
        ].join("\n"),
      },
    ]);
  });

  it("flattens nested objects to dot-path lines under one row", () => {
    expect(
      payloadToApprovalSummaryRows({
        changes: { name: "renamed", metadata: { owner: "tony" } },
      })
    ).toEqual([
      { label: "changes", value: "name: renamed\nmetadata.owner: tony" },
    ]);
  });

  it("drops empty objects, empty arrays, and nullish values entirely", () => {
    expect(
      payloadToApprovalSummaryRows({
        annotations: {},
        tags: [],
        description: null,
        examples: [{ metadata: {} }],
      })
    ).toEqual([]);
  });
});
