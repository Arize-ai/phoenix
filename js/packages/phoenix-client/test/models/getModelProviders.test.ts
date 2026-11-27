import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import { getModelProviders } from "../../src/models/getModelProviders";
import { createTestClient } from "../testUtils";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  server.use(serverVersionHandler("20.4.0"));
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

function serverVersionHandler(version: string) {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

describe("getModelProviders", () => {
  it("returns the providers filtered by the server", async () => {
    server.use(
      http.get("/v1/model_providers", ({ response }) =>
        response(200).json({
          data: [
            { provider: "ANTHROPIC", name: "Anthropic" },
            { provider: "AWS", name: "AWS Bedrock" },
          ],
        })
      )
    );

    const modelProviders = await getModelProviders({
      client: createTestClient(),
    });

    expect(modelProviders).toEqual([
      { provider: "ANTHROPIC", name: "Anthropic" },
      { provider: "AWS", name: "AWS Bedrock" },
    ]);
  });

  it("returns an empty list when the server enables no providers", async () => {
    server.use(
      http.get("/v1/model_providers", ({ response }) =>
        response(200).json({ data: [] })
      )
    );

    const modelProviders = await getModelProviders({
      client: createTestClient(),
    });

    expect(modelProviders).toEqual([]);
  });

  it("fails before listing providers on unsupported Phoenix servers", async () => {
    let listRequestCount = 0;
    server.use(
      serverVersionHandler("20.3.0"),
      http.get("/v1/model_providers", ({ response }) => {
        listRequestCount += 1;
        return response(200).json({ data: [] });
      })
    );

    await expect(
      getModelProviders({ client: createTestClient() })
    ).rejects.toThrow(/requires Phoenix server >= 20\.4\.0/);

    expect(listRequestCount).toBe(0);
  });
});
