import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import { deleteSpan } from "../../src/spans/deleteSpan";
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

describe("deleteSpan", () => {
  it("should delete a span successfully", async () => {
    let receivedSpanIdentifier: string | undefined;

    server.use(
      http.delete("/v1/spans/{span_identifier}", ({ params, response }) => {
        receivedSpanIdentifier = params.span_identifier;
        return response(204).empty();
      })
    );

    await expect(
      deleteSpan({
        client: createTestClient(),
        spanIdentifier: "test-span-123",
      })
    ).resolves.toBeUndefined();

    expect(receivedSpanIdentifier).toBe("test-span-123");
  });

  it("should delete a span by OpenTelemetry span_id", async () => {
    let receivedSpanIdentifier: string | undefined;

    server.use(
      http.delete("/v1/spans/{span_identifier}", ({ params, response }) => {
        receivedSpanIdentifier = params.span_identifier;
        return response(204).empty();
      })
    );

    await expect(
      deleteSpan({
        client: createTestClient(),
        spanIdentifier: "abc123def456",
      })
    ).resolves.toBeUndefined();

    expect(receivedSpanIdentifier).toBe("abc123def456");
  });

  it("should delete a span by Phoenix Global ID", async () => {
    let receivedSpanIdentifier: string | undefined;

    server.use(
      http.delete("/v1/spans/{span_identifier}", ({ params, response }) => {
        receivedSpanIdentifier = params.span_identifier;
        return response(204).empty();
      })
    );

    await expect(
      deleteSpan({
        client: createTestClient(),
        spanIdentifier: "U3BhbjoyMzQ1Njc4OQ==",
      })
    ).resolves.toBeUndefined();

    expect(receivedSpanIdentifier).toBe("U3BhbjoyMzQ1Njc4OQ==");
  });

  it("should throw error when span is not found (404)", async () => {
    // The client middleware surfaces non-2xx responses as HttpError.
    server.use(
      http.delete("/v1/spans/{span_identifier}", ({ response }) =>
        response(404).text("Not Found")
      )
    );

    const deletePromise = deleteSpan({
      client: createTestClient(),
      spanIdentifier: "nonexistent-span",
    });

    await expect(deletePromise).rejects.toThrow(HttpError);
    await expect(deletePromise).rejects.toMatchObject({ status: 404 });
  });

  it("should throw error for other API errors", async () => {
    server.use(
      http.delete("/v1/spans/{span_identifier}", ({ response }) =>
        response.untyped(new Response("Internal Server Error", { status: 500 }))
      )
    );

    const deletePromise = deleteSpan({
      client: createTestClient(),
      spanIdentifier: "test-span-123",
    });

    await expect(deletePromise).rejects.toThrow(HttpError);
    await expect(deletePromise).rejects.toMatchObject({ status: 500 });
  });

  it("should handle errors without message", async () => {
    server.use(
      http.delete("/v1/spans/{span_identifier}", ({ response }) =>
        response.untyped(new Response(null, { status: 400 }))
      )
    );

    const deletePromise = deleteSpan({
      client: createTestClient(),
      spanIdentifier: "test-span-123",
    });

    await expect(deletePromise).rejects.toThrow(HttpError);
    await expect(deletePromise).rejects.toMatchObject({ status: 400 });
  });
});
