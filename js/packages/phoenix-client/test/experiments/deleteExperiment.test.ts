import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { PhoenixClient } from "../../src/client";
import { deleteExperiment } from "../../src/experiments/deleteExperiment";
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

type CapturedDeleteRequest = {
  experimentId: string;
  searchParams: URLSearchParams;
};

/**
 * Register a handler for the experiment deletion endpoint that captures every
 * request and answers with 204 No Content.
 */
function captureDeleteRequests(): CapturedDeleteRequest[] {
  const deleteRequests: CapturedDeleteRequest[] = [];
  server.use(
    http.delete(
      "/v1/experiments/{experiment_id}",
      ({ params, request, response }) => {
        deleteRequests.push({
          experimentId: params.experiment_id,
          searchParams: new URL(request.url).searchParams,
        });
        return response(204).empty();
      }
    )
  );
  return deleteRequests;
}

/**
 * Build a stub {@link PhoenixClient} whose `DELETE` resolves with the given
 * openapi-fetch result shape.
 *
 * `deleteExperiment` maps `{ error }` results into descriptive errors. Clients
 * built by `createClient` throw an HttpError on non-2xx responses before that
 * shape is ever produced, so the mapping is only reachable with a
 * caller-supplied client — these tests stub one instead of using real HTTP.
 */
function createStubClient(deleteResult: {
  data: null;
  error: unknown;
}): PhoenixClient {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate partial stub of PhoenixClient; only DELETE is exercised
  return {
    DELETE: async () => deleteResult,
  } as unknown as PhoenixClient;
}

describe("deleteExperiment", () => {
  it("should delete an experiment successfully", async () => {
    const deleteRequests = captureDeleteRequests();

    await expect(
      deleteExperiment({
        client: createTestClient(),
        experimentId: "exp-123",
      })
    ).resolves.toBeUndefined();

    expect(deleteRequests).toHaveLength(1);
    expect(deleteRequests[0]?.experimentId).toBe("exp-123");
  });

  it("should not pass delete_project query param when deleteProject is not supplied", async () => {
    const deleteRequests = captureDeleteRequests();

    await expect(
      deleteExperiment({
        client: createTestClient(),
        experimentId: "exp-123",
      })
    ).resolves.toBeUndefined();

    expect(deleteRequests).toHaveLength(1);
    expect(deleteRequests[0]?.searchParams.has("delete_project")).toBe(false);
  });

  it("should pass delete_project query param when deleteProject is true", async () => {
    const deleteRequests = captureDeleteRequests();

    await expect(
      deleteExperiment({
        client: createTestClient(),
        experimentId: "exp-123",
        deleteProject: true,
      })
    ).resolves.toBeUndefined();

    expect(deleteRequests).toHaveLength(1);
    expect(deleteRequests[0]?.experimentId).toBe("exp-123");
    expect(deleteRequests[0]?.searchParams.get("delete_project")).toBe("true");
  });

  it("should pass delete_project query param when deleteProject is false", async () => {
    const deleteRequests = captureDeleteRequests();

    await expect(
      deleteExperiment({
        client: createTestClient(),
        experimentId: "exp-123",
        deleteProject: false,
      })
    ).resolves.toBeUndefined();

    expect(deleteRequests).toHaveLength(1);
    expect(deleteRequests[0]?.experimentId).toBe("exp-123");
    expect(deleteRequests[0]?.searchParams.get("delete_project")).toBe("false");
  });

  it("should throw error when experiment is not found (404)", async () => {
    const stubClient = createStubClient({
      data: null,
      error: {
        status: 404,
        message: "Not Found",
      },
    });

    await expect(
      deleteExperiment({
        client: stubClient,
        experimentId: "nonexistent-exp",
      })
    ).rejects.toThrow("Experiment not found: nonexistent-exp");
  });

  it("should throw error for other API errors", async () => {
    const stubClient = createStubClient({
      data: null,
      error: {
        status: 500,
        message: "Internal Server Error",
      },
    });

    await expect(
      deleteExperiment({
        client: stubClient,
        experimentId: "exp-123",
      })
    ).rejects.toThrow("Failed to delete experiment:");
  });

  it("should handle errors without status", async () => {
    const stubClient = createStubClient({
      data: null,
      error: {
        message: "Unknown error",
      },
    });

    await expect(
      deleteExperiment({
        client: stubClient,
        experimentId: "exp-123",
      })
    ).rejects.toThrow("Failed to delete experiment:");
  });

  it("should handle string errors", async () => {
    const stubClient = createStubClient({
      data: null,
      error: "Something went wrong",
    });

    await expect(
      deleteExperiment({
        client: stubClient,
        experimentId: "exp-123",
      })
    ).rejects.toThrow("Failed to delete experiment: Something went wrong");
  });

  it("should handle null errors", async () => {
    const stubClient = createStubClient({
      data: null,
      error: null,
    });

    await expect(
      deleteExperiment({
        client: stubClient,
        experimentId: "exp-123",
      })
    ).resolves.toBeUndefined();
  });

  it("should handle errors with detailed response", async () => {
    const stubClient = createStubClient({
      data: null,
      error: {
        status: 400,
        message: "Bad Request",
        details: {
          field: "experimentId",
          issue: "invalid format",
        },
      },
    });

    await expect(
      deleteExperiment({
        client: stubClient,
        experimentId: "bad-id",
      })
    ).rejects.toThrow("Failed to delete experiment:");
  });
});
