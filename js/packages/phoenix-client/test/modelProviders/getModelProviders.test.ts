import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getModelProviders } from "../../src/modelProviders/getModelProviders";
import { createTestClient } from "../testUtils";

const http = createHttp();

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
});
