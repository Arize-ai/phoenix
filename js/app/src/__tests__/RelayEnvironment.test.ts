import type { RequestParameters } from "relay-runtime";
import { Observable } from "relay-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/authFetch", () => ({
  authFetch: authFetchMock,
}));

import { ServerResponseError } from "../components/exception/serverConnectionError";
import { fetchRelay } from "../RelayEnvironment";
import { INCREMENTAL_ACCEPT_HEADER } from "../relayIncrementalDelivery";
import {
  buildStrawberryMultipartBody,
  createMultipartResponse,
} from "./multipartResponse";

const REQUEST: RequestParameters = {
  cacheID: "server-response-test",
  id: null,
  metadata: {},
  name: "ServerResponseTestQuery",
  operationKind: "query",
  text: "query ServerResponseTestQuery { __typename }",
};

const DEFER_REQUEST: RequestParameters = {
  cacheID: "defer-test",
  id: null,
  metadata: {},
  name: "DeferTestQuery",
  operationKind: "query",
  text: 'query DeferTestQuery { node(id: "x") { ...Scores @defer(label: "Scores$defer") } }',
};

const DEFER_INITIAL_PART = {
  data: { node: { id: "UHJvamVjdDox", name: "default" } },
  hasNext: true,
  pending: [{ id: "0", path: ["node"], label: "Scores$defer" }],
  extensions: null,
};

function executeObservable(request: RequestParameters) {
  const result = fetchRelay(request, {}, {});
  if (!(result instanceof Observable)) {
    throw new TypeError(
      "Expected the Relay fetch function to return an Observable"
    );
  }
  return result;
}

function collectPayloads(request: RequestParameters) {
  const payloads: unknown[] = [];
  return new Promise<unknown[]>((resolve, reject) => {
    executeObservable(request).subscribe({
      next: (payload) => payloads.push(payload),
      complete: () => resolve(payloads),
      error: reject,
    });
  });
}

function executeRequest() {
  return executeObservable(REQUEST).toPromise();
}

beforeEach(() => {
  authFetchMock.mockReset();
});

describe("fetchRelay", () => {
  it("tags a non-GraphQL 503 response with its HTTP status", async () => {
    authFetchMock.mockResolvedValue(
      new Response("upstream connect error", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );

    const error = await executeRequest().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServerResponseError);
    expect(error).toMatchObject({ status: 503 });
  });

  it("leaves a valid GraphQL error envelope untagged", async () => {
    authFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: "connect ECONNREFUSED 127.0.0.1:11434" }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const error = await executeRequest().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ServerResponseError);
    expect(error).toMatchObject({
      message: expect.stringContaining("connect ECONNREFUSED"),
    });
  });

  it("tags a JSON body with neither data nor errors", async () => {
    authFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ extensions: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const error = await executeRequest().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServerResponseError);
    expect(error).toMatchObject({ status: 200 });
  });
});

describe("fetchRelay with @defer", () => {
  it("asks for a multipart response and emits each part as it streams", async () => {
    authFetchMock.mockResolvedValue(
      createMultipartResponse({
        body: buildStrawberryMultipartBody([
          DEFER_INITIAL_PART,
          {
            hasNext: false,
            extensions: null,
            completed: [{ id: "0" }],
            incremental: [{ data: { traceCount: 264 }, id: "0" }],
          },
        ]),
        chunkSize: 5,
      })
    );

    const payloads = await collectPayloads(DEFER_REQUEST);

    expect(authFetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: INCREMENTAL_ACCEPT_HEADER }),
      })
    );
    expect(payloads).toEqual([
      [{ data: DEFER_INITIAL_PART.data, extensions: { is_final: false } }],
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

  it("does not ask for a multipart response without @defer", async () => {
    authFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { __typename: "Query" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await executeRequest();

    const init: RequestInit | undefined = authFetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has("Accept")).toBe(false);
  });

  it("accepts a JSON response to a @defer operation", async () => {
    authFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { node: null } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(collectPayloads(DEFER_REQUEST)).resolves.toEqual([
      { data: { node: null } },
    ]);
  });

  it("errors the operation when a deferred fragment fails", async () => {
    authFetchMock.mockResolvedValue(
      createMultipartResponse({
        body: buildStrawberryMultipartBody([
          DEFER_INITIAL_PART,
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
        ]),
      })
    );

    await expect(collectPayloads(DEFER_REQUEST)).rejects.toMatchObject({
      message: expect.stringContaining("scores failed"),
    });
  });

  it("tags a non-OK multipart response with its HTTP status", async () => {
    authFetchMock.mockResolvedValue(
      createMultipartResponse({
        body: buildStrawberryMultipartBody([DEFER_INITIAL_PART]),
        status: 502,
      })
    );

    const error = await collectPayloads(DEFER_REQUEST).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(ServerResponseError);
    expect(error).toMatchObject({ status: 502 });
  });
});

describe("fetchRelay request cancellation", () => {
  it("does not abort the request signal after the request completes", async () => {
    authFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { __typename: "Query" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await executeRequest();

    const init: RequestInit | undefined = authFetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // Aborting a finished request still rejects any promise tied to its
    // signal with an AbortError, which surfaces as an unhandled rejection.
    expect(init?.signal?.aborted).toBe(false);
  });
});
