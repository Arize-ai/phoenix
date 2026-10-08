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
import {
  deletePromptVersionTag,
  upsertPromptVersionTag,
} from "../../src/prompts";
import { createTestClient } from "../testUtils";

const http = createHttp();

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

describe("upsertPromptVersionTag", () => {
  it("creates a tag on the target prompt version", async () => {
    const captured: { body?: unknown; promptVersionId?: string } = {};
    server.use(
      serverVersionHandler("13.20.0"),
      http.post(
        "/v1/prompt_versions/{prompt_version_id}/tags",
        async ({ params, request, response }) => {
          captured.promptVersionId = params.prompt_version_id;
          captured.body = await request.json();
          return response(204).empty();
        }
      )
    );

    await expect(
      upsertPromptVersionTag({
        client: createTestClient(),
        prompt: { versionId: "prompt-version-2" },
        name: "production",
        description: "Currently deployed version",
      })
    ).resolves.toBeUndefined();

    expect(captured).toEqual({
      promptVersionId: "prompt-version-2",
      body: {
        name: "production",
        description: "Currently deployed version",
      },
    });
  });

  it("moves an existing prompt-scoped tag to the target version", async () => {
    let tagVersionId = "prompt-version-1";
    server.use(
      serverVersionHandler("13.20.0"),
      http.post(
        "/v1/prompt_versions/{prompt_version_id}/tags",
        async ({ params, request, response }) => {
          const body = await request.json();
          if (body.name === "production") {
            tagVersionId = params.prompt_version_id;
          }
          return response(204).empty();
        }
      )
    );

    await upsertPromptVersionTag({
      client: createTestClient(),
      prompt: { versionId: "prompt-version-2" },
      name: "production",
    });

    expect(tagVersionId).toBe("prompt-version-2");
  });

  it.each([404, 422] as const)("propagates a %s response", async (status) => {
    server.use(
      serverVersionHandler("13.20.0"),
      http.post("/v1/prompt_versions/{prompt_version_id}/tags", () =>
        Response.json({ detail: "Tag upsert failed" }, { status })
      )
    );

    const result = upsertPromptVersionTag({
      client: createTestClient(),
      prompt: { versionId: "prompt-version-2" },
      name: "production",
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status });
  });

  it("rejects an empty version ID before sending a request", async () => {
    await expect(
      upsertPromptVersionTag({
        client: createTestClient(),
        prompt: { versionId: "" },
        name: "production",
      })
    ).rejects.toThrow("versionId must be a non-empty prompt version id.");
  });

  it("fails fast on Phoenix servers older than 8.22.0", async () => {
    let upsertRequestCount = 0;
    server.use(
      serverVersionHandler("8.21.0"),
      http.post(
        "/v1/prompt_versions/{prompt_version_id}/tags",
        ({ response }) => {
          upsertRequestCount += 1;
          return response(204).empty();
        }
      )
    );

    await expect(
      upsertPromptVersionTag({
        client: createTestClient(),
        prompt: { versionId: "prompt-version-2" },
        name: "production",
      })
    ).rejects.toThrow(/requires Phoenix server >= 8\.22\.0/);

    expect(upsertRequestCount).toBe(0);
  });
});

describe("deletePromptVersionTag", () => {
  it("deletes a tag by prompt version ID and name", async () => {
    const captured: { name?: string; promptVersionId?: string } = {};
    server.use(
      serverVersionHandler("13.20.0"),
      http.delete(
        "/v1/prompt_versions/{prompt_version_id}/tags/{tag_name}",
        ({ params, response }) => {
          captured.promptVersionId = params.prompt_version_id;
          captured.name = params.tag_name;
          return response(204).empty();
        }
      )
    );

    await expect(
      deletePromptVersionTag({
        client: createTestClient(),
        prompt: { versionId: "prompt-version-2" },
        name: "production",
      })
    ).resolves.toBeUndefined();

    expect(captured).toEqual({
      promptVersionId: "prompt-version-2",
      name: "production",
    });
  });

  it.each([404, 422] as const)("propagates a %s response", async (status) => {
    server.use(
      serverVersionHandler("13.20.0"),
      http.delete(
        "/v1/prompt_versions/{prompt_version_id}/tags/{tag_name}",
        () => Response.json({ detail: "Tag deletion failed" }, { status })
      )
    );

    const result = deletePromptVersionTag({
      client: createTestClient(),
      prompt: { versionId: "prompt-version-2" },
      name: "production",
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status });
  });

  it("rejects an empty version ID before sending a request", async () => {
    await expect(
      deletePromptVersionTag({
        client: createTestClient(),
        prompt: { versionId: "" },
        name: "production",
      })
    ).rejects.toThrow("versionId must be a non-empty prompt version id.");
  });

  it("fails fast on Phoenix servers older than 13.20.0", async () => {
    let deleteRequestCount = 0;
    server.use(
      serverVersionHandler("13.19.2"),
      http.delete(
        "/v1/prompt_versions/{prompt_version_id}/tags/{tag_name}",
        ({ response }) => {
          deleteRequestCount += 1;
          return response(204).empty();
        }
      )
    );

    await expect(
      deletePromptVersionTag({
        client: createTestClient(),
        prompt: { versionId: "prompt-version-2" },
        name: "production",
      })
    ).rejects.toThrow(/requires Phoenix server >= 13\.20\.0/);

    expect(deleteRequestCount).toBe(0);
  });
});
