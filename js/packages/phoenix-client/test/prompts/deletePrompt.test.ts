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

import { HttpError } from "../../src/errors";
import { deletePrompt } from "../../src/prompts";
import { createTestClient } from "../testUtils";

const http = createHttp();

/**
 * Handler that reports the given Phoenix server version. The capability guard
 * in deletePrompt resolves the server version by fetching this endpoint, and
 * the endpoint returns the version string as plain text.
 */
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

describe("deletePrompt", () => {
  it("DELETEs the prompt by name", async () => {
    const captured: { identifier?: string } = {};
    server.use(
      serverVersionHandler("13.20.0"),
      http.delete("/v1/prompts/{prompt_identifier}", ({ params, response }) => {
        captured.identifier = params.prompt_identifier;
        return response(204).empty();
      })
    );

    await expect(
      deletePrompt({
        client: createTestClient(),
        promptIdentifier: "my-prompt",
      })
    ).resolves.toBeUndefined();

    expect(captured.identifier).toBe("my-prompt");
  });

  it("DELETEs the prompt by global ID", async () => {
    const captured: { identifier?: string } = {};
    server.use(
      serverVersionHandler("13.20.0"),
      http.delete("/v1/prompts/{prompt_identifier}", ({ params, response }) => {
        captured.identifier = params.prompt_identifier;
        return response(204).empty();
      })
    );

    await deletePrompt({
      client: createTestClient(),
      promptIdentifier: "UHJvbXB0OjE=",
    });

    expect(captured.identifier).toBe("UHJvbXB0OjE=");
  });

  it("rejects an empty identifier without calling the server", async () => {
    let deleteRequestCount = 0;
    server.use(
      serverVersionHandler("13.20.0"),
      http.delete("/v1/prompts/{prompt_identifier}", ({ response }) => {
        deleteRequestCount += 1;
        return response(204).empty();
      })
    );

    await expect(
      deletePrompt({ client: createTestClient(), promptIdentifier: "" })
    ).rejects.toThrow(
      "promptIdentifier must be a non-empty prompt name or ID."
    );

    expect(deleteRequestCount).toBe(0);
  });

  it("reports a missing prompt by identifier", async () => {
    server.use(
      serverVersionHandler("13.20.0"),
      http.delete("/v1/prompts/{prompt_identifier}", ({ response }) =>
        response.untyped(new Response("Prompt not found", { status: 404 }))
      )
    );

    const error = await deletePrompt({
      client: createTestClient(),
      promptIdentifier: "missing-prompt",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Prompt not found: missing-prompt");
    expect((error as Error).cause).toBeInstanceOf(HttpError);
    expect(((error as Error).cause as HttpError).status).toBe(404);
  });

  it("surfaces other server errors as HttpError", async () => {
    server.use(
      serverVersionHandler("13.20.0"),
      http.delete("/v1/prompts/{prompt_identifier}", ({ response }) =>
        response.untyped(new Response("Boom", { status: 500 }))
      )
    );

    const error = await deletePrompt({
      client: createTestClient(),
      promptIdentifier: "my-prompt",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(500);
  });

  it("fails fast on older Phoenix servers", async () => {
    let deleteRequestCount = 0;

    server.use(
      serverVersionHandler("13.19.2"),
      http.delete("/v1/prompts/{prompt_identifier}", ({ response }) => {
        deleteRequestCount += 1;
        return response(204).empty();
      })
    );

    await expect(
      deletePrompt({
        client: createTestClient(),
        promptIdentifier: "my-prompt",
      })
    ).rejects.toThrow(/requires Phoenix server >= 13\.20\.0/);

    expect(deleteRequestCount).toBe(0);
  });
});
