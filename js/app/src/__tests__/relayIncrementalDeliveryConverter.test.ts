import { describe, expect, it } from "vitest";

import { createIncrementalDeliveryConverter } from "../relayIncrementalDeliveryConverter";

const LABEL = "Table$defer$Scores";

function convertAll(parts: unknown[]) {
  const converter = createIncrementalDeliveryConverter();
  return parts.map((part) => converter.convert(part));
}

describe("createIncrementalDeliveryConverter", () => {
  it("sends a deferred fragment whole, with the fields the server deduplicated", () => {
    const [initial, subsequent] = convertAll([
      {
        data: { evaluator: { id: "1", name: "correctness" } },
        pending: [{ id: "0", path: ["evaluator"], label: LABEL }],
        hasNext: true,
      },
      {
        incremental: [{ id: "0", data: { meanScore: 0.5 } }],
        completed: [{ id: "0" }],
        hasNext: false,
      },
    ]);
    expect(initial).toEqual([
      {
        data: { evaluator: { id: "1", name: "correctness" } },
        extensions: { is_final: false },
      },
    ]);
    expect(subsequent).toEqual([
      {
        data: { id: "1", name: "correctness", meanScore: 0.5 },
        label: LABEL,
        path: ["evaluator"],
        extensions: { is_final: true },
      },
    ]);
  });

  it("places a result's data at its subPath below the pending path", () => {
    const [, subsequent] = convertAll([
      {
        data: { evaluator: { id: "1", summary: { count: 3 } } },
        pending: [{ id: "0", path: ["evaluator"], label: LABEL }],
        hasNext: true,
      },
      {
        incremental: [
          { id: "0", subPath: ["summary"], data: { meanScore: 0.5 } },
        ],
        completed: [{ id: "0" }],
        hasNext: false,
      },
    ]);
    expect(subsequent[0].data).toEqual({
      id: "1",
      summary: { count: 3, meanScore: 0.5 },
    });
  });

  it("waits for a fragment to complete before sending it", () => {
    const [, partial, done] = convertAll([
      {
        data: { evaluator: { id: "1" } },
        pending: [{ id: "0", path: ["evaluator"], label: LABEL }],
        hasNext: true,
      },
      { incremental: [{ id: "0", data: { a: 1 } }], hasNext: true },
      {
        incremental: [{ id: "0", data: { b: 2 } }],
        completed: [{ id: "0" }],
        hasNext: false,
      },
    ]);
    expect(partial).toEqual([]);
    expect(done[0].data).toEqual({ id: "1", a: 1, b: 2 });
  });

  it("makes a field error's path relative to its deferred fragment", () => {
    const [, subsequent] = convertAll([
      {
        data: { evaluators: [{ id: "1" }] },
        pending: [{ id: "0", path: ["evaluators", 0], label: LABEL }],
        hasNext: true,
      },
      {
        incremental: [
          {
            id: "0",
            data: { meanScore: null },
            errors: [{ message: "boom", path: ["evaluators", 0, "meanScore"] }],
          },
        ],
        completed: [{ id: "0" }],
        hasNext: false,
      },
    ]);
    expect(subsequent[0]).toMatchObject({
      errors: [{ message: "boom", path: ["meanScore"] }],
      label: LABEL,
      path: ["evaluators", 0],
    });
  });

  it("sends a fragment that failed as a whole as a payload without data, with its errors", () => {
    const [, subsequent] = convertAll([
      {
        data: { evaluator: { id: "1" } },
        pending: [{ id: "0", path: ["evaluator"], label: LABEL }],
        hasNext: true,
      },
      {
        completed: [
          {
            id: "0",
            errors: [{ message: "boom", path: ["evaluator", "meanScore"] }],
          },
        ],
        hasNext: false,
      },
    ]);
    expect(subsequent).toEqual([
      {
        errors: [
          expect.objectContaining({ message: "boom", path: ["meanScore"] }),
        ],
        label: LABEL,
        path: ["evaluator"],
        extensions: { is_final: true },
      },
    ]);
  });

  it("sends each streamed item at its index in the list", () => {
    const [, subsequent] = convertAll([
      {
        data: { series: [{ t: 0 }] },
        pending: [{ id: "0", path: ["series"], label: "Series$stream" }],
        hasNext: true,
      },
      {
        incremental: [{ id: "0", items: [{ t: 1 }, { t: 2 }] }],
        completed: [{ id: "0" }],
        hasNext: false,
      },
    ]);
    expect(subsequent).toEqual([
      { data: { t: 1 }, label: "Series$stream", path: ["series", 1] },
      {
        data: { t: 2 },
        label: "Series$stream",
        path: ["series", 2],
        extensions: { is_final: true },
      },
    ]);
  });

  it("ends the request on a final part with no payloads", () => {
    const [, final] = convertAll([
      {
        data: { evaluator: { id: "1" } },
        pending: [{ id: "0", path: ["evaluator"], label: LABEL }],
        hasNext: true,
      },
      { hasNext: false },
    ]);
    expect(final).toEqual([{ data: null, extensions: { is_final: true } }]);
  });

  it("passes a plain response and a label/path payload through unchanged", () => {
    const plain = { data: { node: null } };
    const labelPath = { data: { a: 1 }, label: LABEL, path: ["node"] };
    expect(convertAll([plain, labelPath])).toEqual([[plain], [labelPath]]);
  });

  it("rejects a pending result without a label", () => {
    expect(() =>
      convertAll([
        { data: {}, pending: [{ id: "0", path: ["node"] }], hasNext: true },
      ])
    ).toThrow("to have a label");
  });

  it("passes a part without hasNext through as a plain response", () => {
    const part = { data: { node: { id: "1" } }, pending: [] };
    expect(convertAll([part])).toEqual([[{ data: { node: { id: "1" } } }]]);
  });

  it("passes a part with hasNext but no field only the new format has through", () => {
    const part = { data: { node: null }, hasNext: true };
    expect(convertAll([part])).toEqual([[{ data: { node: null } }]]);
  });

  it("rejects a part that is not an object", () => {
    expect(() => convertAll(["not a response"])).toThrow();
  });

  it("rejects an incremental result without the id of its pending result", () => {
    expect(() =>
      convertAll([
        {
          data: { node: { id: "1" } },
          pending: [{ id: "0", path: ["node"], label: LABEL }],
          hasNext: true,
        },
        { incremental: [{ data: { a: 1 } }], hasNext: false },
      ])
    ).toThrow();
  });

  it("rejects an incremental result for an id that was never pending", () => {
    expect(() =>
      convertAll([
        { data: {}, pending: [], hasNext: true },
        { incremental: [{ id: "9", data: { a: 1 } }], hasNext: false },
      ])
    ).toThrow("pending result with id `9`");
  });
});
