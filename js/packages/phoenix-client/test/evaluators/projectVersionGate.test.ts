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

vi.unmock("../../src/utils/serverVersionUtils");

import { getProjectEvaluators } from "../../src/evaluators";
import { createTestClient } from "../testUtils";

const http = createHttp();

/** Reports the given Phoenix server version, which the capability guard fetches once. */
function serverVersionHandler(version: string) {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("project evaluator methods gate on the server version", () => {
  it("refuses a server older than 21.0.0 before sending the request", async () => {
    let listed = false;
    server.use(
      serverVersionHandler("20.9.0"),
      http.get(
        "/v1/projects/{project_identifier}/evaluators",
        ({ response }) => {
          listed = true;
          return response(200).json({ data: [], next_cursor: null });
        }
      )
    );

    await expect(
      getProjectEvaluators({
        client: createTestClient(),
        project: { project: "support-bot" },
      })
    ).rejects.toThrow(/21\.0\.0/);
    expect(listed).toBe(false);
  });

  it("proceeds against a 21.0.0 server", async () => {
    server.use(
      serverVersionHandler("21.0.0"),
      http.get("/v1/projects/{project_identifier}/evaluators", ({ response }) =>
        response(200).json({ data: [], next_cursor: null })
      )
    );

    await expect(
      getProjectEvaluators({
        client: createTestClient(),
        project: { project: "support-bot" },
      })
    ).resolves.toEqual([]);
  });
});
