import type { RequestParameters } from "relay-runtime";
import { Observable } from "relay-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/authFetch", () => ({
  authFetch: authFetchMock,
}));

import { ServerResponseError } from "../components/exception/serverConnectionError";
import { fetchRelay } from "../RelayEnvironment";

const REQUEST: RequestParameters = {
  cacheID: "server-response-test",
  id: null,
  metadata: {},
  name: "ServerResponseTestQuery",
  operationKind: "query",
  text: "query ServerResponseTestQuery { __typename }",
};

function executeRequest() {
  const result = fetchRelay(REQUEST, {}, {});
  if (!(result instanceof Observable)) {
    throw new TypeError(
      "Expected the Relay fetch function to return an Observable"
    );
  }
  return result.toPromise();
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
});
