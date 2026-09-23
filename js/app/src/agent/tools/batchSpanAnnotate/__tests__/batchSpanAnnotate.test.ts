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
  applySpanAnnotations,
  parseBatchSpanAnnotateInput,
} from "@phoenix/agent/tools/batchSpanAnnotate";

function getValidSpanNodeId(rowId: string): string {
  return globalThis.btoa(`Span:${rowId}`);
}

function getParsedBatch(input: unknown) {
  const parsed = parseBatchSpanAnnotateInput(input);
  expect(parsed).not.toBeNull();
  return parsed!;
}

type FetchVariables = {
  spanNodeId?: string;
  spanId?: string;
};

function mockResolvedFetchQueries() {
  relayMocks.fetchQuery.mockImplementation(
    (_environment: unknown, _query: unknown, variables: FetchVariables) => {
      if (variables.spanNodeId) {
        return {
          toPromise: () =>
            Promise.resolve({
              viewer: { id: "viewer-1" },
              span: { __typename: "Span", id: variables.spanNodeId },
            }),
        };
      }
      return {
        toPromise: () =>
          Promise.resolve({
            viewer: { id: "viewer-1" },
            span: { id: getValidSpanNodeId("2") },
          }),
      };
    }
  );
}

function mockSuccessfulCommit() {
  relayMocks.commitMutation.mockImplementation(
    (
      _environment: unknown,
      config: {
        onCompleted: (
          response: unknown,
          errors?: readonly { message?: string }[] | null
        ) => void;
      }
    ) => {
      config.onCompleted({}, null);
    }
  );
}

describe("batch span annotate parsing", () => {
  it("accepts only the canonical wrapped input and normalizes stable keys", () => {
    const parsed = getParsedBatch({
      annotations: [
        {
          spanId: "ABCDEF0123456789",
          name: "  Quality  ",
          label: "good",
          identifier: " qualitative-coding:v1, ",
        },
      ],
    });

    expect(parsed).toEqual([
      expect.objectContaining({
        spanId: "abcdef0123456789",
        name: "Quality",
        identifier: "qualitative-coding:v1,",
        annotatorKind: "LLM",
      }),
    ]);
  });

  it("rejects aliases, malformed span node IDs, reserved names, and ambiguous targets", () => {
    expect(
      parseBatchSpanAnnotateInput({
        annotations: [
          {
            span_id: "abcdef0123456789",
            name: "quality",
            label: "good",
          },
        ],
      })
    ).toBeNull();
    expect(
      parseBatchSpanAnnotateInput({
        annotations: [
          {
            spanNodeId: `${getValidSpanNodeId("1153")}=`,
            name: "quality",
            label: "good",
          },
        ],
      })
    ).toBeNull();
    expect(
      parseBatchSpanAnnotateInput({
        annotations: [
          {
            spanId: "abcdef0123456789",
            name: "note",
            label: "good",
          },
        ],
      })
    ).toBeNull();
    expect(
      parseBatchSpanAnnotateInput({
        annotations: [
          {
            spanId: "abcdef0123456789",
            spanNodeId: getValidSpanNodeId("1"),
            name: "quality",
            label: "good",
          },
        ],
      })
    ).toBeNull();
  });

  it("rejects legacy bare array and single-annotation object forms", () => {
    expect(
      parseBatchSpanAnnotateInput([
        { spanId: "abcdef0123456789", name: "quality", label: "good" },
      ])
    ).toBeNull();
    expect(
      parseBatchSpanAnnotateInput({
        spanId: "abcdef0123456789",
        name: "quality",
        label: "good",
      })
    ).toBeNull();
  });
});

describe("applySpanAnnotations", () => {
  beforeEach(() => {
    relayMocks.commitMutation.mockReset();
    relayMocks.fetchQuery.mockReset();
    mockResolvedFetchQueries();
    mockSuccessfulCommit();
  });

  it("resolves every target before committing a single batch mutation", async () => {
    const annotations = getParsedBatch({
      annotations: [
        {
          spanNodeId: getValidSpanNodeId("1"),
          name: "quality",
          label: "good",
        },
        {
          spanId: "abcdef0123456789",
          name: "latency",
          score: 0.5,
        },
      ],
    });

    await applySpanAnnotations(annotations);

    expect(relayMocks.fetchQuery).toHaveBeenCalledTimes(2);
    expect(relayMocks.commitMutation).toHaveBeenCalledTimes(1);
    expect(relayMocks.commitMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: expect.objectContaining({
          filterUserIds: ["viewer-1"],
          input: [
            expect.objectContaining({
              spanId: getValidSpanNodeId("1"),
              name: "quality",
            }),
            expect.objectContaining({
              spanId: getValidSpanNodeId("2"),
              name: "latency",
            }),
          ],
        }),
      })
    );
  });

  it("does not commit any annotations when a later target fails to resolve", async () => {
    relayMocks.fetchQuery.mockImplementation(
      (_environment: unknown, _query: unknown, variables: FetchVariables) => {
        if (variables.spanNodeId === getValidSpanNodeId("404")) {
          return {
            toPromise: () =>
              Promise.resolve({
                viewer: { id: "viewer-1" },
                span: null,
              }),
          };
        }
        return {
          toPromise: () =>
            Promise.resolve({
              viewer: { id: "viewer-1" },
              span: { __typename: "Span", id: variables.spanNodeId },
            }),
        };
      }
    );
    const annotations = getParsedBatch({
      annotations: [
        {
          spanNodeId: getValidSpanNodeId("1"),
          name: "quality",
          label: "good",
        },
        {
          spanNodeId: getValidSpanNodeId("404"),
          name: "latency",
          score: 0.5,
        },
      ],
    });

    await expect(applySpanAnnotations(annotations)).rejects.toThrow(
      'Failed to resolve target for annotation "latency" at index 1'
    );

    expect(relayMocks.commitMutation).not.toHaveBeenCalled();
  });
});
