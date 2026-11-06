import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { PhoenixClient } from "../../src/client";
import { HttpError } from "../../src/errors";
import { type SecretInput, upsertOrDeleteSecrets } from "../../src/secrets";
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

describe("upsertOrDeleteSecrets", () => {
  it("upserts a batch and returns key names without secret values", async () => {
    const firstValue = "first-sensitive-value";
    const secondValue = "second-sensitive-value";
    let receivedSecrets: SecretInput[] | undefined;

    server.use(
      http.put("/v1/secrets", async ({ request, response }) => {
        const body = (await request.json()) as { secrets: SecretInput[] };
        receivedSecrets = body.secrets;
        return response(200).json({
          data: {
            upserted_keys: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
            deleted_keys: [],
          },
        });
      })
    );

    const result = await upsertOrDeleteSecrets({
      client: createTestClient(),
      secrets: [
        { key: "OPENAI_API_KEY", value: firstValue },
        { key: "ANTHROPIC_API_KEY", value: secondValue },
      ],
    });

    expect(receivedSecrets).toEqual([
      { key: "OPENAI_API_KEY", value: firstValue },
      { key: "ANTHROPIC_API_KEY", value: secondValue },
    ]);
    expect(result).toEqual({
      upsertedKeys: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      deletedKeys: [],
    });
    expect(JSON.stringify(result)).not.toContain(firstValue);
    expect(JSON.stringify(result)).not.toContain(secondValue);
  });

  it("deletes secrets whose values are null", async () => {
    let receivedSecrets: SecretInput[] | undefined;

    server.use(
      http.put("/v1/secrets", async ({ request, response }) => {
        const body = (await request.json()) as { secrets: SecretInput[] };
        receivedSecrets = body.secrets;
        return response(200).json({
          data: {
            upserted_keys: [],
            deleted_keys: ["OLD_PROVIDER_API_KEY"],
          },
        });
      })
    );

    const result = await upsertOrDeleteSecrets({
      client: createTestClient(),
      secrets: [{ key: "OLD_PROVIDER_API_KEY", value: null }],
    });

    expect(receivedSecrets).toEqual([
      { key: "OLD_PROVIDER_API_KEY", value: null },
    ]);
    expect(result).toEqual({
      upsertedKeys: [],
      deletedKeys: ["OLD_PROVIDER_API_KEY"],
    });
  });

  it("preserves duplicate order so the last value wins", async () => {
    const oldValue = "old-sensitive-value";
    const newValue = "new-sensitive-value";
    let receivedSecrets: SecretInput[] | undefined;

    server.use(
      http.put("/v1/secrets", async ({ request, response }) => {
        const body = (await request.json()) as { secrets: SecretInput[] };
        receivedSecrets = body.secrets;
        const lastUpdate = body.secrets.at(-1);
        if (!lastUpdate) {
          throw new Error("Expected a non-empty secrets batch");
        }
        return response(200).json({
          data: {
            upserted_keys: lastUpdate.value === null ? [] : [lastUpdate.key],
            deleted_keys: lastUpdate.value === null ? [lastUpdate.key] : [],
          },
        });
      })
    );

    const result = await upsertOrDeleteSecrets({
      client: createTestClient(),
      secrets: [
        { key: "SHARED_API_KEY", value: oldValue },
        { key: "SHARED_API_KEY", value: null },
        { key: "SHARED_API_KEY", value: newValue },
      ],
    });

    expect(receivedSecrets).toEqual([
      { key: "SHARED_API_KEY", value: oldValue },
      { key: "SHARED_API_KEY", value: null },
      { key: "SHARED_API_KEY", value: newValue },
    ]);
    expect(result).toEqual({
      upsertedKeys: ["SHARED_API_KEY"],
      deletedKeys: [],
    });
  });

  it("surfaces server errors without adding submitted values to the message", async () => {
    const secretValue = "server-error-sensitive-value";

    server.use(
      http.put("/v1/secrets", ({ response }) =>
        response.untyped(
          new Response(`Could not store ${secretValue}`, { status: 500 })
        )
      )
    );

    const error = await upsertOrDeleteSecrets({
      client: createTestClient(),
      secrets: [{ key: "OPENAI_API_KEY", value: secretValue }],
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(500);
    expect((error as Error).message).not.toContain(secretValue);
  });

  it("does not decorate typed API errors with submitted values", async () => {
    const secretValue = "typed-error-sensitive-value";
    const client = {
      PUT: async () => ({
        data: undefined,
        error: { detail: `Invalid value: ${secretValue}` },
      }),
    } as unknown as PhoenixClient;

    const error = await upsertOrDeleteSecrets({
      client,
      secrets: [{ key: "OPENAI_API_KEY", value: secretValue }],
    }).catch((caughtError: unknown) => caughtError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Failed to upsert or delete secrets");
    expect((error as Error).message).not.toContain(secretValue);
  });

  it("fails with a value-free message when the server returns no data", async () => {
    const secretValue = "missing-data-sensitive-value";

    server.use(
      http.put("/v1/secrets", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      upsertOrDeleteSecrets({
        client: createTestClient(),
        secrets: [{ key: "OPENAI_API_KEY", value: secretValue }],
      })
    ).rejects.not.toThrow(secretValue);
  });
});
