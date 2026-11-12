import type { RequestParameters } from "relay-runtime";
import { Observable } from "relay-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/authFetch", () => ({
  authFetch: authFetchMock,
}));

import { fetchRelay } from "../RelayEnvironment";
import {
  INCREMENTAL_ACCEPT_HEADER,
  readMultipartMixed,
  usesIncrementalDelivery,
} from "../relayIncrementalDelivery";

function strawberryBody(parts: unknown[]): string {
  const encoded = parts.map((part) => {
    const json = JSON.stringify(part);
    return `\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${json.length}\r\n\r\n${json}\r\n---`;
  });
  return `---${encoded.join("")}--\r\n`;
}

function multipartResponse(body: string, chunkSize = body.length): Response {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": 'multipart/mixed; boundary="-"' },
  });
}

const INITIAL = {
  data: { node: { id: "UHJvamVjdDox", name: "default" } },
  hasNext: true,
  pending: [{ id: "0", path: ["node"], label: "Scores$defer" }],
  extensions: null,
};
const SUBSEQUENT = {
  hasNext: false,
  extensions: null,
  completed: [{ id: "0" }],
  incremental: [
    {
      data: { traceCount: 264 },
      id: "0",
      path: ["node"],
      label: "Scores$defer",
    },
  ],
};

async function collect(response: Response): Promise<unknown[]> {
  const parts: unknown[] = [];
  for await (const part of readMultipartMixed(response)) {
    parts.push(part);
  }
  return parts;
}

describe("readMultipartMixed", () => {
  it("yields each part's JSON body", async () => {
    const parts = await collect(
      multipartResponse(strawberryBody([INITIAL, SUBSEQUENT]))
    );
    expect(parts).toEqual([INITIAL, SUBSEQUENT]);
  });

  it("reassembles parts split across chunks, including the delimiters", async () => {
    const body = strawberryBody([INITIAL, SUBSEQUENT]);
    for (const chunkSize of [1, 2, 3, 7, 64]) {
      expect(await collect(multipartResponse(body, chunkSize))).toEqual([
        INITIAL,
        SUBSEQUENT,
      ]);
    }
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

describe("fetchRelay with @defer", () => {
  const REQUEST: RequestParameters = {
    cacheID: "defer-test",
    id: null,
    metadata: {},
    name: "DeferTestQuery",
    operationKind: "query",
    text: 'query DeferTestQuery { node(id: "x") { ...Scores @defer(label: "Scores$defer") } }',
  };

  beforeEach(() => {
    authFetchMock.mockReset();
  });

  function execute() {
    const result = fetchRelay(REQUEST, {}, {});
    if (!(result instanceof Observable)) {
      throw new TypeError("Expected an Observable");
    }
    return result;
  }

  it("asks for a multipart response and emits each part as it streams", async () => {
    authFetchMock.mockResolvedValue(
      multipartResponse(strawberryBody([INITIAL, SUBSEQUENT]), 5)
    );
    const payloads: unknown[] = [];
    await new Promise<void>((resolve, reject) => {
      execute().subscribe({
        next: (payload) => payloads.push(payload),
        complete: resolve,
        error: reject,
      });
    });
    expect(authFetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: INCREMENTAL_ACCEPT_HEADER }),
      })
    );
    expect(payloads).toEqual([
      [{ data: INITIAL.data, extensions: { is_final: false } }],
      [
        {
          data: { id: "UHJvamVjdDox", name: "default", traceCount: 264 },
          path: ["node"],
          label: "Scores$defer",
          extensions: { is_final: true },
        },
      ],
    ]);
  });

  it("still accepts a plain JSON response", async () => {
    authFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { node: null } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await expect(execute().toPromise()).resolves.toEqual({
      data: { node: null },
    });
  });

  it("errors the operation when a deferred payload carries errors", async () => {
    authFetchMock.mockResolvedValue(
      multipartResponse(
        strawberryBody([
          INITIAL,
          {
            hasNext: false,
            completed: [
              {
                id: "0",
                errors: [
                  { message: "scores failed", path: ["node", "traceCount"] },
                ],
              },
            ],
          },
        ])
      )
    );
    const error = await new Promise((resolve) => {
      execute().subscribe({ error: resolve, complete: () => resolve(null) });
    });
    expect(error).toMatchObject({
      message: expect.stringContaining("scores failed"),
    });
  });
});
