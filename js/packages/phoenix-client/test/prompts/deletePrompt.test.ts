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

import { HttpError } from "../../src/errors";
import { deletePrompt } from "../../src/prompts";
import type {
  GetPromptByTagSelector,
  PromptIdentifier,
} from "../../src/types/prompts";
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

/**
 * Handler that records the `{prompt_identifier}` the client interpolated into
 * the request path and answers 204, as a successful deletion does.
 */
function captureDeleteHandler(captured: { identifier?: string }) {
  return http.delete(
    "/v1/prompts/{prompt_identifier}",
    ({ params, response }) => {
      captured.identifier = params.prompt_identifier;
      return response(204).empty();
    }
  );
}

describe("deletePrompt", () => {
  it("DELETEs the prompt selected by name", async () => {
    const captured: { identifier?: string } = {};
    server.use(serverVersionHandler("13.20.0"), captureDeleteHandler(captured));

    await expect(
      deletePrompt({
        client: createTestClient(),
        prompt: { name: "my-prompt" },
      })
    ).resolves.toBeUndefined();

    expect(captured.identifier).toBe("my-prompt");
  });

  it("DELETEs the prompt selected by prompt id", async () => {
    const captured: { identifier?: string } = {};
    server.use(serverVersionHandler("13.20.0"), captureDeleteHandler(captured));

    await deletePrompt({
      client: createTestClient(),
      prompt: { promptId: "UHJvbXB0OjE=" },
    });

    expect(captured.identifier).toBe("UHJvbXB0OjE=");
  });

  describe("selector validation", () => {
    let deleteRequestCount = 0;

    beforeEach(() => {
      deleteRequestCount = 0;
      server.use(
        serverVersionHandler("13.20.0"),
        http.delete("/v1/prompts/{prompt_identifier}", ({ response }) => {
          deleteRequestCount += 1;
          return response(204).empty();
        })
      );
    });

    it("rejects an empty name", async () => {
      await expect(
        deletePrompt({ client: createTestClient(), prompt: { name: "" } })
      ).rejects.toThrow("name must be a non-empty prompt name.");

      expect(deleteRequestCount).toBe(0);
    });

    it("rejects an empty prompt id", async () => {
      await expect(
        deletePrompt({ client: createTestClient(), prompt: { promptId: "" } })
      ).rejects.toThrow("promptId must be a non-empty prompt id.");

      expect(deleteRequestCount).toBe(0);
    });

    it("rejects a version selector rather than deleting the whole prompt", async () => {
      const versionSelector = {
        versionId: "UHJvbXB0VmVyc2lvbjox",
      } as unknown as PromptIdentifier;

      await expect(
        deletePrompt({ client: createTestClient(), prompt: versionSelector })
      ).rejects.toThrow(/selects a single version, not a prompt/);

      expect(deleteRequestCount).toBe(0);
    });

    it("rejects a name + tag selector rather than ignoring the tag", async () => {
      // Structural typing lets a tag selector reach a PromptIdentifier
      // parameter, so the guard has to be a runtime one.
      const tagSelector: PromptIdentifier = {
        name: "my-prompt",
        tag: "production",
      } as GetPromptByTagSelector;

      await expect(
        deletePrompt({ client: createTestClient(), prompt: tagSelector })
      ).rejects.toThrow(/selects a single version, not a prompt/);

      expect(deleteRequestCount).toBe(0);
    });

    it("rejects a selector with neither name nor prompt id", async () => {
      await expect(
        deletePrompt({
          client: createTestClient(),
          prompt: {} as unknown as PromptIdentifier,
        })
      ).rejects.toThrow(
        "A prompt must be selected by either name or promptId."
      );

      expect(deleteRequestCount).toBe(0);
    });
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
      prompt: { name: "missing-prompt" },
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
      prompt: { name: "my-prompt" },
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
        prompt: { name: "my-prompt" },
      })
    ).rejects.toThrow(/requires Phoenix server >= 13\.20\.0/);

    expect(deleteRequestCount).toBe(0);
  });
});
