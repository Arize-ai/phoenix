import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { authApiFetch } from "@phoenix/api/authApiFetch";

import {
  downloadSingleSpan,
  downloadSpanCollection,
  getSpanDownloadTimestamp,
  sanitizeSpanDownloadFileName,
} from "../spanDownloadUtils";

vi.mock("@phoenix/api/authApiFetch", () => ({
  authApiFetch: {
    GET: vi.fn(),
  },
}));

const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();

// The openapi-fetch client is deeply generic; a loose mock keeps the request
// stubs in these tests readable.
const apiGet = authApiFetch.GET as unknown as Mock;

type ApiGetOptions = { params: { query: Record<string, unknown> } };

/** Download options that skip every annotation request. */
const withoutAnnotations = {
  includeSpanAnnotations: false,
  includeTraceAnnotations: false,
} as const;

/** Returns the query object of every span request made so far. */
function getRequestQueries(): Record<string, unknown>[] {
  return apiGet.mock.calls.map(
    (call) => (call[1] as ApiGetOptions).params.query
  );
}

/** Builds `count` synthetic IDs, each suffixed with its position. */
function makeIds({
  prefix,
  count,
}: {
  prefix: string;
  count: number;
}): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

/** Builds a successful span-page response for the mocked API client. */
function okPage({
  spans,
  nextCursor = null,
}: {
  spans: unknown[];
  nextCursor?: string | null;
}) {
  return {
    data: { data: spans, next_cursor: nextCursor },
    response: new Response(null, { status: 200 }),
  };
}

/** A minimal writable that records everything written to it. */
function createWritableSpy() {
  const chunks: string[] = [];
  return {
    chunks,
    write: vi.fn(async (text: string) => {
      chunks.push(text);
    }),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  };
}

/** A save-file picker stub that hands out the given writable. */
function createPickerSpy(writable: unknown) {
  return vi.fn(async () => ({ createWritable: async () => writable }));
}

/** Installs a `window.showSaveFilePicker` stub with the given behavior. */
function mockSaveFilePicker(picker: unknown) {
  Object.defineProperty(window, "showSaveFilePicker", {
    configurable: true,
    value: picker,
  });
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Expected Blob text"));
        return;
      }
      resolve(reader.result);
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

function getDownloadedBlob(): Blob {
  const blob = createObjectURL.mock.calls[0]?.[0];
  if (!(blob instanceof Blob)) {
    throw new Error("Expected a downloaded Blob");
  }
  return blob;
}

describe("spanDownloadUtils", () => {
  beforeEach(() => {
    createObjectURL.mockReturnValue("blob:span-download");
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "showSaveFilePicker");
    apiGet.mockReset();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("sanitizes file names and formats timestamps", () => {
    expect(sanitizeSpanDownloadFileName("my project/name")).toBe(
      "my_project_name"
    );
    expect(getSpanDownloadTimestamp(new Date("2026-07-24T18:30:45.000Z"))).toBe(
      "2026-07-24T18-30-45"
    );
  });

  it("downloads a single span as formatted Phoenix JSON", async () => {
    const span = {
      name: "test-span",
      context: { span_id: "span-id", trace_id: "trace-id" },
      span_kind: "CHAIN",
      start_time: "2026-07-24T18:30:45Z",
      end_time: "2026-07-24T18:30:46Z",
      status_code: "OK",
    };
    apiGet.mockResolvedValueOnce(okPage({ spans: [span] }));

    await downloadSingleSpan({
      projectId: "project-id",
      spanId: "span-id",
      format: "json",
      fileName: "span.json",
      ...withoutAnnotations,
    });

    expect(authApiFetch.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project-id" },
          query: { limit: 1, span_id: ["span-id"] },
        },
      }
    );
    expect(authApiFetch.GET).toHaveBeenCalledTimes(1);
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      `${JSON.stringify(span, null, 2)}\n`
    );
  });

  it("wraps a single OTLP span in the OTLP JSON envelope", async () => {
    const otlpSpan = { span_id: "span-id", trace_id: "trace-id" };
    apiGet.mockResolvedValueOnce(okPage({ spans: [otlpSpan] }));

    await downloadSingleSpan({
      projectId: "project-id",
      spanId: "span-id",
      format: "otlp-json",
      fileName: "span-otlp.json",
      ...withoutAnnotations,
    });

    expect(authApiFetch.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans/otlpv1",
      {
        params: {
          path: { project_identifier: "project-id" },
          query: { limit: 1, span_id: ["span-id"] },
        },
      }
    );
    expect(authApiFetch.GET).toHaveBeenCalledTimes(1);
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      JSON.stringify({
        resource_spans: [{ scope_spans: [{ spans: [otlpSpan] }] }],
      })
    );
  });

  it("does not prompt for a save location for a single span", async () => {
    const picker = vi.fn();
    mockSaveFilePicker(picker);
    apiGet.mockResolvedValueOnce(okPage({ spans: [{ span_id: "span-id" }] }));

    await downloadSingleSpan({
      projectId: "project-id",
      spanId: "span-id",
      format: "otlp-json",
      fileName: "span-otlp.json",
      ...withoutAnnotations,
    });

    expect(picker).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it("downloads a complete trace as JSONL", async () => {
    const span = {
      name: "test-span",
      context: { span_id: "span-id", trace_id: "trace-id" },
      span_kind: "CHAIN",
      start_time: "2026-07-24T18:30:45Z",
      end_time: "2026-07-24T18:30:46Z",
      status_code: "OK",
      attributes: { existing: "value" },
    };
    const spanAnnotation = {
      id: "span-annotation-id",
      created_at: "2026-07-24T18:30:47Z",
      updated_at: "2026-07-24T18:30:47Z",
      source: "API" as const,
      user_id: null,
      name: "hallucination",
      annotator_kind: "LLM" as const,
      result: {
        score: 0.25,
        label: "likely",
        explanation: "Unsupported claim",
      },
      metadata: { evaluator: "faithfulness" },
      identifier: "eval-1",
      span_id: "span-id",
    };
    const traceAnnotation = {
      id: "trace-annotation-id",
      created_at: "2026-07-24T18:30:48Z",
      updated_at: "2026-07-24T18:30:48Z",
      source: "APP" as const,
      user_id: null,
      name: "user_frustration",
      annotator_kind: "HUMAN" as const,
      result: { label: "high" },
      metadata: {},
      identifier: "",
      trace_id: "trace-id",
    };
    apiGet
      .mockResolvedValueOnce(okPage({ spans: [span] }))
      .mockResolvedValueOnce(okPage({ spans: [spanAnnotation] }))
      .mockResolvedValueOnce(okPage({ spans: [traceAnnotation] }));

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
      includeSpanAnnotations: true,
      includeTraceAnnotations: true,
    });

    expect(authApiFetch.GET).toHaveBeenNthCalledWith(
      1,
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project-id" },
          query: { limit: 1000, trace_id: ["trace-id"] },
        },
      }
    );
    expect(authApiFetch.GET).toHaveBeenNthCalledWith(
      2,
      "/v1/projects/{project_identifier}/span_annotations",
      {
        params: {
          path: { project_identifier: "project-id" },
          query: { limit: 1000, span_ids: ["span-id"] },
        },
      }
    );
    expect(authApiFetch.GET).toHaveBeenNthCalledWith(
      3,
      "/v1/projects/{project_identifier}/trace_annotations",
      {
        params: {
          path: { project_identifier: "project-id" },
          query: { limit: 1000, trace_ids: ["trace-id"] },
        },
      }
    );
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      `${JSON.stringify({
        ...span,
        attributes: {
          existing: "value",
          "annotations.0.annotation.name": "hallucination",
          "annotations.0.annotation.annotator_kind": "LLM",
          "annotations.0.annotation.score": 0.25,
          "annotations.0.annotation.label": "likely",
          "annotations.0.annotation.explanation": "Unsupported claim",
          "annotations.0.annotation.identifier": "eval-1",
          "annotations.0.annotation.metadata": '{"evaluator":"faithfulness"}',
          "trace.annotations.0.annotation.name": "user_frustration",
          "trace.annotations.0.annotation.annotator_kind": "HUMAN",
          "trace.annotations.0.annotation.label": "high",
        },
      })}\n`
    );
  });

  it("adds annotations as OTLP attributes", async () => {
    const otlpSpan = {
      span_id: "span-id",
      trace_id: "trace-id",
      attributes: [{ key: "existing", value: { string_value: "value" } }],
    };
    const spanAnnotation = {
      id: "span-annotation-id",
      created_at: "2026-07-24T18:30:47Z",
      updated_at: "2026-07-24T18:30:47Z",
      source: "API" as const,
      user_id: null,
      name: "hallucination",
      annotator_kind: "CODE" as const,
      result: { score: 0.5 },
      metadata: {},
      identifier: "",
      span_id: "span-id",
    };
    const traceAnnotation = {
      id: "trace-annotation-id",
      created_at: "2026-07-24T18:30:48Z",
      updated_at: "2026-07-24T18:30:48Z",
      source: "APP" as const,
      user_id: null,
      name: "user_frustration",
      annotator_kind: "HUMAN" as const,
      result: { label: "high" },
      metadata: {},
      identifier: "",
      trace_id: "trace-id",
    };
    apiGet
      .mockResolvedValueOnce(okPage({ spans: [otlpSpan] }))
      .mockResolvedValueOnce(okPage({ spans: [spanAnnotation] }))
      .mockResolvedValueOnce(okPage({ spans: [traceAnnotation] }));

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "otlp-json",
      fileName: "trace.json",
      includeSpanAnnotations: true,
      includeTraceAnnotations: true,
    });

    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      JSON.stringify({
        resource_spans: [
          {
            scope_spans: [
              {
                spans: [
                  {
                    ...otlpSpan,
                    attributes: [
                      ...otlpSpan.attributes,
                      {
                        key: "annotations.0.annotation.name",
                        value: { string_value: "hallucination" },
                      },
                      {
                        key: "annotations.0.annotation.annotator_kind",
                        value: { string_value: "CODE" },
                      },
                      {
                        key: "annotations.0.annotation.score",
                        value: { double_value: 0.5 },
                      },
                      {
                        key: "trace.annotations.0.annotation.name",
                        value: { string_value: "user_frustration" },
                      },
                      {
                        key: "trace.annotations.0.annotation.annotator_kind",
                        value: { string_value: "HUMAN" },
                      },
                      {
                        key: "trace.annotations.0.annotation.label",
                        value: { string_value: "high" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    );
  });

  it("adds trace annotations only to the root span", async () => {
    const childSpan = {
      name: "child-span",
      context: { span_id: "child-span-id", trace_id: "trace-id" },
      span_kind: "LLM",
      parent_id: "root-span-id",
      start_time: "2026-07-24T18:30:45Z",
      end_time: "2026-07-24T18:30:46Z",
      status_code: "OK",
    };
    const rootSpan = {
      name: "root-span",
      context: { span_id: "root-span-id", trace_id: "trace-id" },
      span_kind: "CHAIN",
      parent_id: null,
      start_time: "2026-07-24T18:30:44Z",
      end_time: "2026-07-24T18:30:47Z",
      status_code: "OK",
    };
    const traceAnnotation = {
      id: "trace-annotation-id",
      created_at: "2026-07-24T18:30:48Z",
      updated_at: "2026-07-24T18:30:48Z",
      source: "APP" as const,
      user_id: null,
      name: "user_frustration",
      annotator_kind: "HUMAN" as const,
      result: { label: "high" },
      metadata: {},
      identifier: "",
      trace_id: "trace-id",
    };
    apiGet
      .mockResolvedValueOnce(okPage({ spans: [childSpan, rootSpan] }))
      .mockResolvedValueOnce(okPage({ spans: [traceAnnotation] }));

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
      includeSpanAnnotations: false,
      includeTraceAnnotations: true,
    });

    const [exportedChild, exportedRoot] = (await readBlob(getDownloadedBlob()))
      .trim()
      .split("\n");
    expect(exportedChild).toBe(JSON.stringify(childSpan));
    expect(exportedRoot).toBe(
      JSON.stringify({
        ...rootSpan,
        attributes: {
          "trace.annotations.0.annotation.name": "user_frustration",
          "trace.annotations.0.annotation.annotator_kind": "HUMAN",
          "trace.annotations.0.annotation.label": "high",
        },
      })
    );
    expect(authApiFetch.GET).toHaveBeenCalledTimes(2);
  });

  it("emits trace annotations once when a trace straddles pages", async () => {
    const childSpan = {
      name: "child-span",
      context: { span_id: "child-span-id", trace_id: "trace-id" },
      parent_id: "root-span-id",
    };
    const rootSpan = {
      name: "root-span",
      context: { span_id: "root-span-id", trace_id: "trace-id" },
      parent_id: null,
    };
    const traceAnnotation = {
      id: "trace-annotation-id",
      created_at: "2026-07-24T18:30:48Z",
      updated_at: "2026-07-24T18:30:48Z",
      source: "APP" as const,
      user_id: null,
      name: "user_frustration",
      annotator_kind: "HUMAN" as const,
      result: { label: "high" },
      metadata: {},
      identifier: "",
      trace_id: "trace-id",
    };
    apiGet
      .mockResolvedValueOnce(
        okPage({ spans: [childSpan], nextCursor: "cursor-1" })
      )
      .mockResolvedValueOnce(okPage({ spans: [traceAnnotation] }))
      .mockResolvedValueOnce(okPage({ spans: [rootSpan] }));

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
      includeSpanAnnotations: false,
      includeTraceAnnotations: true,
    });

    // Having claimed the trace, the second page skips the request entirely
    // instead of re-fetching annotations it would only discard.
    expect(
      apiGet.mock.calls.filter(([route]) =>
        String(route).endsWith("/trace_annotations")
      )
    ).toHaveLength(1);
    // The first page to carry the trace wins, so the later root span goes out
    // unannotated rather than repeating the trace annotation.
    const [exportedChild, exportedRoot] = (await readBlob(getDownloadedBlob()))
      .trim()
      .split("\n");
    expect(exportedChild).toBe(
      JSON.stringify({
        ...childSpan,
        attributes: {
          "trace.annotations.0.annotation.name": "user_frustration",
          "trace.annotations.0.annotation.annotator_kind": "HUMAN",
          "trace.annotations.0.annotation.label": "high",
        },
      })
    );
    expect(exportedRoot).toBe(JSON.stringify(rootSpan));
  });

  it("frames a multi-page OTLP export as a single span array", async () => {
    const firstSpan = { span_id: "span-1", trace_id: "trace-id" };
    const secondSpan = { span_id: "span-2", trace_id: "trace-id" };
    apiGet
      .mockResolvedValueOnce(
        okPage({ spans: [firstSpan], nextCursor: "cursor-1" })
      )
      .mockResolvedValueOnce(okPage({ spans: [secondSpan] }));

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "otlp-json",
      fileName: "trace.json",
      ...withoutAnnotations,
    });

    // The separator between pages is the export's only cross-page state, so a
    // second page must extend the array rather than restart or double-comma it.
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      JSON.stringify({
        resource_spans: [{ scope_spans: [{ spans: [firstSpan, secondSpan] }] }],
      })
    );
  });

  it("batches span IDs 250 at a time and trace IDs 125 at a time", async () => {
    apiGet.mockResolvedValue(okPage({ spans: [] }));
    const spanIds = makeIds({ prefix: "span", count: 300 });

    await downloadSpanCollection({
      projectId: "project-id",
      spanIds,
      format: "jsonl",
      fileName: "spans.jsonl",
      ...withoutAnnotations,
    });

    expect(getRequestQueries().map((query) => query.span_id)).toEqual([
      spanIds.slice(0, 250),
      spanIds.slice(250),
    ]);

    apiGet.mockClear();
    const traceIds = makeIds({ prefix: "trace", count: 200 });

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds,
      format: "jsonl",
      fileName: "traces.jsonl",
      ...withoutAnnotations,
    });

    expect(getRequestQueries().map((query) => query.trace_id)).toEqual([
      traceIds.slice(0, 125),
      traceIds.slice(125),
    ]);
  });

  it("fetches ID batches with bounded concurrency", async () => {
    let inFlightRequests = 0;
    let maxInFlightRequests = 0;
    apiGet.mockImplementation(async () => {
      inFlightRequests += 1;
      maxInFlightRequests = Math.max(maxInFlightRequests, inFlightRequests);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlightRequests -= 1;
      return okPage({ spans: [] });
    });

    await downloadSpanCollection({
      projectId: "project-id",
      spanIds: makeIds({ prefix: "span", count: 3000 }),
      format: "jsonl",
      fileName: "spans.jsonl",
      ...withoutAnnotations,
    });

    // 3000 IDs / 250 per batch, at most 6 batches in flight at once.
    expect(apiGet).toHaveBeenCalledTimes(12);
    expect(maxInFlightRequests).toBe(6);
  });

  it("paginates within a batch and reports cumulative progress", async () => {
    const firstSpan = { name: "first", context: { span_id: "span-1" } };
    const secondSpan = { name: "second", context: { span_id: "span-2" } };
    apiGet
      .mockResolvedValueOnce(
        okPage({ spans: [firstSpan], nextCursor: "cursor-1" })
      )
      .mockResolvedValueOnce(okPage({ spans: [secondSpan] }));
    const onProgress = vi.fn<(spanCount: number) => void>();

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
      ...withoutAnnotations,
      onProgress,
    });

    expect(getRequestQueries().map((query) => query.cursor)).toEqual([
      undefined,
      "cursor-1",
    ]);
    expect(onProgress.mock.calls.flat()).toEqual([1, 2]);
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      `${JSON.stringify(firstSpan)}\n${JSON.stringify(secondSpan)}\n`
    );
  });

  it("streams to a file chosen with the save picker", async () => {
    const span = {
      name: "test-span",
      context: { span_id: "span-id", trace_id: "trace-id" },
    };
    apiGet.mockResolvedValueOnce(okPage({ spans: [span] }));
    const writable = createWritableSpy();
    const picker = createPickerSpy(writable);
    mockSaveFilePicker(picker);

    const outcome = await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
      ...withoutAnnotations,
    });

    expect(outcome).toBe("completed");
    expect(picker).toHaveBeenCalledWith({ suggestedName: "trace.jsonl" });
    expect(writable.chunks.join("")).toBe(`${JSON.stringify(span)}\n`);
    expect(writable.close).toHaveBeenCalledOnce();
    // Nothing is buffered into a blob on the streaming path.
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("reports cancellation when the save picker is dismissed", async () => {
    const picker = vi.fn(() => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });
    mockSaveFilePicker(picker);

    const outcome = await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
      ...withoutAnnotations,
    });

    expect(outcome).toBe("cancelled");
    expect(apiGet).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("falls back to a blob download when the picker fails", async () => {
    const span = {
      name: "test-span",
      context: { span_id: "span-id", trace_id: "trace-id" },
    };
    apiGet.mockResolvedValueOnce(okPage({ spans: [span] }));
    const picker = vi.fn(() => {
      throw new DOMException("No user gesture", "SecurityError");
    });
    mockSaveFilePicker(picker);

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
      ...withoutAnnotations,
    });

    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      `${JSON.stringify(span)}\n`
    );
  });

  it("aborts the file stream when a page fails", async () => {
    apiGet.mockResolvedValueOnce({
      data: undefined,
      error: { detail: "boom" },
      response: new Response(null, { status: 500 }),
    });
    const writable = createWritableSpy();
    mockSaveFilePicker(createPickerSpy(writable));

    await expect(
      downloadSpanCollection({
        projectId: "project-id",
        traceIds: ["trace-id"],
        format: "jsonl",
        fileName: "trace.jsonl",
        ...withoutAnnotations,
      })
    ).rejects.toThrow("HTTP 500: boom");
    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
  });
});
