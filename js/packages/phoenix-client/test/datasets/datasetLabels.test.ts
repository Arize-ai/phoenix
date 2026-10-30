import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { DatasetLabel } from "../../src/datasets";
import {
  createDatasetLabel,
  deleteDatasetLabel,
  getDatasetLabel,
  listDatasetLabels,
  updateDatasetLabel,
} from "../../src/datasets";
import { HttpError } from "../../src/errors";
import { createTestClient } from "../testUtils";

const http = createHttp();

const CURATED_LABEL: DatasetLabel = {
  id: "RGF0YXNldExhYmVsOjE=",
  name: "curated",
  description: "Reviewed examples",
  color: "#00cc88",
};

const GOLDEN_LABEL: DatasetLabel = {
  id: "RGF0YXNldExhYmVsOjI=",
  name: "golden",
  description: null,
  color: "#ffaa00",
};

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

describe("dataset label helpers", () => {
  it("lists one cursor-paginated page", async () => {
    let receivedCursor: string | null = null;
    let receivedLimit: string | null = null;

    server.use(
      http.get("/v1/dataset_labels", ({ request, response }) => {
        const searchParams = new URL(request.url).searchParams;
        receivedCursor = searchParams.get("cursor");
        receivedLimit = searchParams.get("limit");
        return response(200).json({
          data: [CURATED_LABEL],
          next_cursor: "RGF0YXNldExhYmVsOjI=",
        });
      })
    );

    const result = await listDatasetLabels({
      client: createTestClient(),
      cursor: "RGF0YXNldExhYmVsOjM=",
      limit: 1,
    });

    expect(receivedCursor).toBe("RGF0YXNldExhYmVsOjM=");
    expect(receivedLimit).toBe("1");
    expect(result).toEqual({
      datasetLabels: [CURATED_LABEL],
      nextCursor: "RGF0YXNldExhYmVsOjI=",
    });
  });

  it("gets a label by global ID", async () => {
    let receivedLabelId: string | undefined;
    server.use(
      http.get("/v1/dataset_labels/{label_id}", ({ params, response }) => {
        receivedLabelId = params.label_id;
        return response(200).json({ data: CURATED_LABEL });
      })
    );

    await expect(
      getDatasetLabel({
        client: createTestClient(),
        labelId: CURATED_LABEL.id,
      })
    ).resolves.toEqual(CURATED_LABEL);
    expect(receivedLabelId).toBe(CURATED_LABEL.id);
  });

  it("creates a label with generated request and response shapes", async () => {
    let receivedBody: unknown;
    server.use(
      http.post("/v1/dataset_labels", async ({ request, response }) => {
        receivedBody = await request.json();
        return response(201).json({ data: GOLDEN_LABEL });
      })
    );

    const result = await createDatasetLabel({
      client: createTestClient(),
      name: "golden",
      color: "#ffaa00",
      description: null,
    });

    expect(receivedBody).toEqual({
      name: "golden",
      color: "#ffaa00",
      description: null,
    });
    expect(result).toEqual(GOLDEN_LABEL);
  });

  it("surfaces duplicate label names as an HttpError", async () => {
    server.use(
      http.post("/v1/dataset_labels", ({ response }) =>
        response.untyped(
          new Response("A dataset label named 'curated' already exists", {
            status: 409,
          })
        )
      )
    );

    const error = await createDatasetLabel({
      client: createTestClient(),
      name: "curated",
      color: "#00cc88",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(409);
  });

  it("sends only supplied fields for a partial update", async () => {
    let receivedBody: unknown;
    let receivedLabelId: string | undefined;
    server.use(
      http.patch(
        "/v1/dataset_labels/{label_id}",
        async ({ params, request, response }) => {
          receivedLabelId = params.label_id;
          receivedBody = await request.json();
          return response(200).json({
            data: { ...CURATED_LABEL, description: null },
          });
        }
      )
    );

    const result = await updateDatasetLabel({
      client: createTestClient(),
      labelId: CURATED_LABEL.id,
      description: null,
    });

    expect(receivedLabelId).toBe(CURATED_LABEL.id);
    expect(receivedBody).toEqual({ description: null });
    expect(result.description).toBeNull();
  });

  it("surfaces a duplicate name from a partial update", async () => {
    server.use(
      http.patch("/v1/dataset_labels/{label_id}", ({ response }) =>
        response.untyped(
          new Response("A dataset label named 'golden' already exists", {
            status: 409,
          })
        )
      )
    );

    const error = await updateDatasetLabel({
      client: createTestClient(),
      labelId: CURATED_LABEL.id,
      name: "golden",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(409);
  });

  it("deletes a global label and its assignments", async () => {
    let receivedLabelId: string | undefined;
    server.use(
      http.delete("/v1/dataset_labels/{label_id}", ({ params, response }) => {
        receivedLabelId = params.label_id;
        return response(204).empty();
      })
    );

    await expect(
      deleteDatasetLabel({
        client: createTestClient(),
        labelId: CURATED_LABEL.id,
      })
    ).resolves.toBeUndefined();
    expect(receivedLabelId).toBe(CURATED_LABEL.id);
  });

  it("surfaces not-found and server errors", async () => {
    server.use(
      http.get("/v1/dataset_labels/{label_id}", ({ response }) =>
        response.untyped(
          new Response("Dataset label not found", { status: 404 })
        )
      ),
      http.delete("/v1/dataset_labels/{label_id}", ({ response }) =>
        response.untyped(new Response("Internal server error", { status: 500 }))
      )
    );

    const getError = await getDatasetLabel({
      client: createTestClient(),
      labelId: "RGF0YXNldExhYmVsOjk5",
    }).catch((caughtError: unknown) => caughtError);
    const deleteError = await deleteDatasetLabel({
      client: createTestClient(),
      labelId: CURATED_LABEL.id,
    }).catch((caughtError: unknown) => caughtError);

    expect(getError).toBeInstanceOf(HttpError);
    expect((getError as HttpError).status).toBe(404);
    expect(deleteError).toBeInstanceOf(HttpError);
    expect((deleteError as HttpError).status).toBe(500);
  });

  it("rejects an invalid successful response", async () => {
    server.use(
      http.get("/v1/dataset_labels", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      listDatasetLabels({ client: createTestClient() })
    ).rejects.toThrow("Failed to list dataset labels");
  });
});
