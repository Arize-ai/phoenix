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
import { updatePrompt } from "../../src/prompts";
import { createTestClient } from "../testUtils";

const http = createHttp();

/**
 * Handler that reports the given Phoenix server version. The capability guard
 * in updatePrompt resolves the server version by fetching this endpoint, and
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

const UPDATED_PROMPT = {
  id: "prompt-001",
  name: "my-prompt",
  description: "updated",
  metadata: { team: "ml" },
};

describe("updatePrompt", () => {
  it("PATCHes description and metadata and returns the prompt", async () => {
    const captured: { body?: unknown; identifier?: string } = {};
    server.use(
      serverVersionHandler("19.18.0"),
      http.patch(
        "/v1/prompts/{prompt_identifier}",
        async ({ params, request, response }) => {
          captured.identifier = params.prompt_identifier;
          captured.body = await request.json();
          return response(200).json({ data: UPDATED_PROMPT });
        }
      )
    );

    const prompt = await updatePrompt({
      client: createTestClient(),
      promptIdentifier: "my-prompt",
      description: "updated",
      metadata: { team: "ml" },
    });

    expect(captured.identifier).toBe("my-prompt");
    expect(captured.body).toEqual({
      description: "updated",
      metadata: { team: "ml" },
    });
    expect(prompt).toEqual(UPDATED_PROMPT);
  });

  it("omits unset fields from the request body", async () => {
    const captured: { body?: unknown } = {};
    server.use(
      serverVersionHandler("19.18.0"),
      http.patch(
        "/v1/prompts/{prompt_identifier}",
        async ({ request, response }) => {
          captured.body = await request.json();
          return response(200).json({
            data: { ...UPDATED_PROMPT, description: null },
          });
        }
      )
    );

    await updatePrompt({
      client: createTestClient(),
      promptIdentifier: "my-prompt",
      description: null,
    });

    expect(captured.body).toEqual({ description: null });
  });

  it("rejects an empty patch", async () => {
    await expect(
      updatePrompt({
        client: createTestClient(),
        promptIdentifier: "my-prompt",
      })
    ).rejects.toThrow(
      "At least one of description or metadata must be provided."
    );
  });

  it("reports a missing prompt by identifier", async () => {
    server.use(
      serverVersionHandler("19.18.0"),
      http.patch("/v1/prompts/{prompt_identifier}", ({ response }) =>
        response.untyped(new Response("Prompt not found", { status: 404 }))
      )
    );

    const error = await updatePrompt({
      client: createTestClient(),
      promptIdentifier: "missing-prompt",
      description: "updated",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Prompt not found: missing-prompt");
    expect((error as Error).cause).toBeInstanceOf(HttpError);
    expect(((error as Error).cause as HttpError).status).toBe(404);
  });

  it("fails fast on older Phoenix servers", async () => {
    let patchRequestCount = 0;

    server.use(
      serverVersionHandler("19.17.0"),
      http.patch("/v1/prompts/{prompt_identifier}", ({ response }) => {
        patchRequestCount += 1;
        return response(200).json({ data: UPDATED_PROMPT });
      })
    );

    await expect(
      updatePrompt({
        client: createTestClient(),
        promptIdentifier: "my-prompt",
        description: "updated",
      })
    ).rejects.toThrow(/requires Phoenix server >= 19\.18\.0/);

    expect(patchRequestCount).toBe(0);
  });
});
