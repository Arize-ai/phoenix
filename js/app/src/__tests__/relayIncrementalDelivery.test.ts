import { describe, expect, it } from "vitest";

import { ServerResponseError } from "../components/exception/serverConnectionError";
import {
  readMultipartMixed,
  usesIncrementalDelivery,
} from "../relayIncrementalDelivery";
import {
  buildStrawberryMultipartBody,
  createMultipartResponse,
} from "./multipartResponse";

const INITIAL = {
  data: { node: { id: "UHJvamVjdDox" } },
  hasNext: true,
  pending: [{ id: "0", path: ["node"], label: "Scores$defer" }],
  extensions: null,
};
const SUBSEQUENT = {
  hasNext: false,
  extensions: null,
  completed: [{ id: "0" }],
  incremental: [{ data: { traceCount: 264 }, id: "0" }],
};

async function collectParts(response: Response): Promise<unknown[]> {
  const parts: unknown[] = [];
  for await (const part of readMultipartMixed(response)) {
    parts.push(part);
  }
  return parts;
}

describe("readMultipartMixed", () => {
  it("yields each part's JSON body", async () => {
    const parts = await collectParts(
      createMultipartResponse({
        body: buildStrawberryMultipartBody([INITIAL, SUBSEQUENT]),
      })
    );
    expect(parts).toEqual([INITIAL, SUBSEQUENT]);
  });

  it("reassembles parts split across chunks, including the delimiters", async () => {
    const body = buildStrawberryMultipartBody([INITIAL, SUBSEQUENT]);
    for (const chunkSize of [1, 2, 3, 7, 64]) {
      expect(
        await collectParts(createMultipartResponse({ body, chunkSize }))
      ).toEqual([INITIAL, SUBSEQUENT]);
    }
  });

  it("rejects a body that ends before its closing delimiter", async () => {
    const body = buildStrawberryMultipartBody([INITIAL, SUBSEQUENT]);
    const parts: unknown[] = [];
    const reading = (async () => {
      for await (const part of readMultipartMixed(
        createMultipartResponse({
          body: body.slice(0, body.lastIndexOf("--\r\n")),
        })
      )) {
        parts.push(part);
      }
    })();

    await expect(reading).rejects.toBeInstanceOf(ServerResponseError);
    expect(parts).toEqual([INITIAL, SUBSEQUENT]);
  });
});

describe("usesIncrementalDelivery", () => {
  it("detects @defer in the operation text", () => {
    expect(usesIncrementalDelivery('query Q { ...F @defer(label: "x") }')).toBe(
      true
    );
    expect(usesIncrementalDelivery("query Q { deferredCount }")).toBe(false);
    expect(usesIncrementalDelivery(null)).toBe(false);
  });
});
