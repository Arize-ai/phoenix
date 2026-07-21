import { createHttp, type componentsV1 } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import { getSpanAnnotations } from "../../src/spans/getSpanAnnotations";
import { createTestClient } from "../testUtils";

const http = createHttp();

const annotationFixtures: componentsV1["schemas"]["SpanAnnotation"][] = [
  {
    id: "annotation-global-id-123",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    source: "API",
    user_id: null,
    span_id: "span-456",
    name: "quality_score",
    annotator_kind: "LLM",
    result: {
      label: "good",
      score: 0.95,
      explanation: null,
    },
    metadata: {
      model: "gpt-4",
      source: "test",
    },
    identifier: "test-identifier",
  },
  {
    id: "annotation-global-id-124",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    source: "APP",
    user_id: null,
    span_id: "span-457",
    name: "sentiment",
    annotator_kind: "HUMAN",
    result: {
      label: "positive",
      score: 0.8,
      explanation: "User expressed satisfaction",
    },
    metadata: {
      reviewer: "john_doe",
    },
    identifier: "sentiment-001",
  },
];

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
 * Register a handler that answers with the default annotation fixtures and
 * records the request's path param and query string for later assertions.
 */
function captureSpanAnnotationsRequest() {
  const captured: {
    projectIdentifier?: string;
    query?: URLSearchParams;
  } = {};

  server.use(
    http.get(
      "/v1/projects/{project_identifier}/span_annotations",
      ({ params, request, response }) => {
        captured.projectIdentifier = params.project_identifier;
        captured.query = new URL(request.url).searchParams;
        return response(200).json({
          next_cursor: "next-cursor-123",
          data: annotationFixtures,
        });
      }
    )
  );

  return captured;
}

describe("getSpanAnnotations", () => {
  it("should get span annotations with basic parameters", async () => {
    const captured = captureSpanAnnotationsRequest();

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456", "span-457"],
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.annotations[0]?.span_id).toBe("span-456");
    expect(result.annotations[0]?.name).toBe("quality_score");
    expect(result.annotations[1]?.span_id).toBe("span-457");
    expect(result.annotations[1]?.name).toBe("sentiment");
    expect(result.nextCursor).toBe("next-cursor-123");
    expect(captured.projectIdentifier).toBe("test-project");
    expect(captured.query?.getAll("span_ids")).toEqual([
      "span-456",
      "span-457",
    ]);
  });

  it("should get span annotations with all supported filter parameters", async () => {
    const captured = captureSpanAnnotationsRequest();

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
      includeAnnotationNames: ["quality_score"],
      excludeAnnotationNames: ["note"],
      cursor: "cursor-123",
      limit: 50,
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
    expect(captured.query?.getAll("span_ids")).toEqual(["span-456"]);
    expect(captured.query?.getAll("include_annotation_names")).toEqual([
      "quality_score",
    ]);
    expect(captured.query?.getAll("exclude_annotation_names")).toEqual([
      "note",
    ]);
    expect(captured.query?.get("cursor")).toBe("cursor-123");
    expect(captured.query?.get("limit")).toBe("50");
  });

  it("should get span annotations with include annotation names filter", async () => {
    const captured = captureSpanAnnotationsRequest();

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456", "span-457"],
      includeAnnotationNames: ["quality_score"],
    });

    expect(captured.query?.getAll("include_annotation_names")).toEqual([
      "quality_score",
    ]);
    expect(result.annotations).toHaveLength(2);
    // Note: The mock response doesn't simulate filtering by annotation name,
    // so we still get 2 annotations even though in real usage with
    // includeAnnotationNames: ["quality_score"] we would expect only 1
    expect(
      result.annotations.some(
        (annotation) => annotation.name === "quality_score"
      )
    ).toBe(true);
  });

  it("should get span annotations with exclude annotation names filter", async () => {
    const captured = captureSpanAnnotationsRequest();

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456", "span-457"],
      excludeAnnotationNames: ["note"],
    });

    expect(captured.query?.getAll("exclude_annotation_names")).toEqual([
      "note",
    ]);
    expect(result.annotations).toHaveLength(2);
    // Note: The mock response doesn't simulate filtering by annotation name,
    // so we still get 2 annotations even though in real usage with
    // excludeAnnotationNames: ["note"] we would filter out note annotations
    expect(
      result.annotations.every((annotation) => annotation.name !== "note")
    ).toBe(true);
  });

  it("should handle empty arrays for include/exclude filters", async () => {
    const captured = captureSpanAnnotationsRequest();

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
      includeAnnotationNames: [],
      excludeAnnotationNames: [],
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
    // Empty arrays serialize to no query params at all.
    expect(captured.query?.has("include_annotation_names")).toBe(false);
    expect(captured.query?.has("exclude_annotation_names")).toBe(false);
  });

  it("should handle pagination with cursor", async () => {
    const captured = captureSpanAnnotationsRequest();

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
      cursor: "some-cursor-value",
      limit: 25,
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
    expect(captured.query?.get("cursor")).toBe("some-cursor-value");
    expect(captured.query?.get("limit")).toBe("25");
  });

  it("should work with project ID instead of project name", async () => {
    const captured = captureSpanAnnotationsRequest();

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectId: "project-123" },
      spanIds: ["span-456"],
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
    expect(captured.projectIdentifier).toBe("project-123");
  });

  it("should handle empty annotations response", async () => {
    server.use(
      http.get(
        "/v1/projects/{project_identifier}/span_annotations",
        ({ response }) =>
          response(200).json({
            next_cursor: null,
            data: [],
          })
      )
    );

    const result = await getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
    });

    expect(result.annotations).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("should handle API errors", async () => {
    // The client middleware surfaces non-2xx responses as HttpError.
    server.use(
      http.get(
        "/v1/projects/{project_identifier}/span_annotations",
        ({ response }) => response(404).text("API Error")
      )
    );

    const annotationsPromise = getSpanAnnotations({
      client: createTestClient(),
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
    });

    await expect(annotationsPromise).rejects.toThrow(HttpError);
    await expect(annotationsPromise).rejects.toMatchObject({ status: 404 });
  });
});
