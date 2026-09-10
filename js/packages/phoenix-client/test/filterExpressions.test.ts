import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PhoenixClient } from "../src/client";
import { HttpError } from "../src/errors";
import { listSessions } from "../src/sessions/listSessions";
import { getTraces } from "../src/traces/getTraces";
import { createTestClient } from "./testUtils";

vi.unmock("../src/utils/serverVersionUtils");

const http = createHttp();
const condition = 'any(span.name == "café & search" for span in spans)';
const resources = ["traces", "sessions"] as const;
let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => server.close());

function read({
  client,
  resource,
  filter,
}: {
  client: PhoenixClient;
  resource: (typeof resources)[number];
  filter?: string | null;
}) {
  return resource === "traces"
    ? getTraces({ client, project: { project: "project" }, filter })
    : listSessions({ client, project: "project", filter });
}

describe.each(resources)("%s filter expressions", (resource) => {
  it("passes the expression unchanged", async () => {
    const client = createTestClient();
    vi.spyOn(client, "getServerVersion").mockResolvedValue([20, 10, 0]);
    let receivedFilter: string | null = null;
    server.use(
      http.get(
        `/v1/projects/{project_identifier}/${resource}`,
        ({ query, response }) => {
          receivedFilter = query.get("filter");
          return response(200).json({ data: [], next_cursor: null });
        }
      )
    );
    await read({ client, resource, filter: condition });
    expect(receivedFilter).toBe(condition);
  });

  it("rejects unsupported servers before sending a list request", async () => {
    const client = createTestClient();
    vi.spyOn(client, "getServerVersion").mockResolvedValue([20, 9, 0]);
    const get = vi.spyOn(client, "GET");
    await expect(read({ client, resource, filter: condition })).rejects.toThrow(
      /'filter'.*requires Phoenix server >= 20\.10\.0/
    );
    expect(get).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ""])(
    "supports old servers without an expression (%s)",
    async (filter) => {
      const client = createTestClient();
      vi.spyOn(client, "getServerVersion").mockResolvedValue([14, 0, 0]);
      let hasFilter: boolean | undefined;
      server.use(
        http.get(
          `/v1/projects/{project_identifier}/${resource}`,
          ({ query, response }) => {
            hasFilter = query.has("filter");
            return response(200).json({ data: [], next_cursor: null });
          }
        )
      );
      await read({ client, resource, filter });
      expect(hasFilter).toBe(false);
    }
  );

  it("preserves filter error messages from the server", async () => {
    const client = createTestClient();
    vi.spyOn(client, "getServerVersion").mockResolvedValue([20, 10, 0]);
    server.use(
      http.get(
        `/v1/projects/{project_identifier}/${resource}`,
        ({ response }) => response(400).text("invalid name `unknown_field`")
      )
    );
    const error = await read({
      client,
      resource,
      filter: "unknown_field > 0",
    }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(HttpError);
    if (!(error instanceof HttpError))
      throw new Error("Expected an HTTP error");
    expect(error.status).toBe(400);
    expect(await error.response.text()).toBe("invalid name `unknown_field`");
  });
});

it("preserves session filters through automatic pagination", async () => {
  const client = createTestClient();
  vi.spyOn(client, "getServerVersion").mockResolvedValue([20, 10, 0]);
  const cursors: (string | null)[] = [];
  const filters: (string | null)[] = [];
  server.use(
    http.get(
      "/v1/projects/{project_identifier}/sessions",
      ({ query, response }) => {
        cursors.push(query.get("cursor"));
        filters.push(query.get("filter"));
        return response(200).json({
          data: [],
          next_cursor: cursors.length === 1 ? "second-page" : null,
        });
      }
    )
  );
  await listSessions({ client, project: "project", filter: condition });
  expect(cursors).toEqual([null, "second-page"]);
  expect(filters).toEqual([condition, condition]);
});

it("combines expressions with existing trace parameters", async () => {
  const client = createTestClient();
  vi.spyOn(client, "getServerVersion").mockResolvedValue([20, 10, 0]);
  let received: URLSearchParams | undefined;
  server.use(
    http.get(
      "/v1/projects/{project_identifier}/traces",
      ({ request, response }) => {
        received = new URL(request.url).searchParams;
        return response(200).json({ data: [], next_cursor: null });
      }
    )
  );
  await getTraces({
    client,
    project: { project: "project" },
    filter: condition,
    error: false,
    minLatencyMs: 0,
    maxLatencyMs: 500,
    cursor: "next-page",
    sessionId: "session",
  });
  expect(received?.get("filter")).toBe(condition);
  expect(received?.get("error")).toBe("false");
  expect(received?.get("min_latency_ms")).toBe("0");
  expect(received?.get("max_latency_ms")).toBe("500");
  expect(received?.get("cursor")).toBe("next-page");
  expect(received?.get("session_identifier")).toBe("session");
});

it("keeps the legacy trace filters working on 20.8.0", async () => {
  const client = createTestClient();
  vi.spyOn(client, "getServerVersion").mockResolvedValue([20, 8, 0]);
  let hasFilter: boolean | undefined;
  server.use(
    http.get(
      "/v1/projects/{project_identifier}/traces",
      ({ query, response }) => {
        hasFilter = query.has("filter");
        return response(200).json({ data: [], next_cursor: null });
      }
    )
  );
  await getTraces({
    client,
    project: { project: "project" },
    error: false,
    minLatencyMs: 0,
    maxLatencyMs: 500,
  });
  expect(hasFilter).toBe(false);
});
