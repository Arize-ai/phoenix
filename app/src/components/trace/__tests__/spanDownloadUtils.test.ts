import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authApiFetch } from "@phoenix/api/authApiFetch";

import {
  downloadSingleSpan,
  downloadSpanCollection,
  getSpanDownloadTimestamp,
  sanitizeSpanDownloadFileName,
} from "../spanDownloadUtils";
import { mockSpansPageOnce } from "./__fixtures__/mockSpansPage";

vi.mock("@phoenix/api/authApiFetch", () => ({
  authApiFetch: {
    GET: vi.fn(),
  },
}));

const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();

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
    mockSpansPageOnce([span]);

    await downloadSingleSpan({
      projectId: "project-id",
      spanId: "span-id",
      format: "json",
      fileName: "span.json",
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
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      `${JSON.stringify(span, null, 2)}\n`
    );
  });

  it("wraps a single OTLP span in the OTLP JSON envelope", async () => {
    const otlpSpan = { span_id: "span-id", trace_id: "trace-id" };
    mockSpansPageOnce([otlpSpan]);

    await downloadSingleSpan({
      projectId: "project-id",
      spanId: "span-id",
      format: "otlp-json",
      fileName: "span-otlp.json",
    });

    expect(authApiFetch.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans/otlpv1",
      {
        params: {
          path: { project_identifier: "project-id" },
          query: { limit: 1000, span_id: ["span-id"] },
        },
      }
    );
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      JSON.stringify({
        resource_spans: [{ scope_spans: [{ spans: [otlpSpan] }] }],
      })
    );
  });

  it("downloads a complete trace as JSONL", async () => {
    const span = {
      name: "test-span",
      context: { span_id: "span-id", trace_id: "trace-id" },
      span_kind: "CHAIN",
      start_time: "2026-07-24T18:30:45Z",
      end_time: "2026-07-24T18:30:46Z",
      status_code: "OK",
    };
    mockSpansPageOnce([span]);

    await downloadSpanCollection({
      projectId: "project-id",
      traceIds: ["trace-id"],
      format: "jsonl",
      fileName: "trace.jsonl",
    });

    expect(authApiFetch.GET).toHaveBeenCalledWith(
      "/v1/projects/{project_identifier}/spans",
      {
        params: {
          path: { project_identifier: "project-id" },
          query: { limit: 1000, trace_id: ["trace-id"] },
        },
      }
    );
    await expect(readBlob(getDownloadedBlob())).resolves.toBe(
      `${JSON.stringify(span)}\n`
    );
  });
});
