import chunk from "lodash/chunk";

import type { components } from "@phoenix/api/__generated__/v1";
import { authApiFetch } from "@phoenix/api/authApiFetch";

type OtlpSpan = components["schemas"]["OtlpSpan"];
type PhoenixSpan = components["schemas"]["Span"];

const PAGE_SIZE = 1000;

// Cap IDs per request so the GET query string stays under common
// server/proxy URL-length limits and the SQL IN() clause stays under database
// bound-parameter limits.
const ID_BATCH_SIZE = 100;

// Defer object-URL revocation so the browser has time to start reading a
// large blob before the URL is invalidated (matches the FileSaver pattern).
const URL_REVOKE_DELAY_MS = 40_000;

export type SpanDownloadScope = "spans" | "traces";
export type SpanDownloadFormat = "jsonl" | "otlp-json";
export type SingleSpanDownloadFormat = "json" | "otlp-json";

export const SPAN_DOWNLOAD_FILE_EXTENSIONS: Record<SpanDownloadFormat, string> =
  {
    jsonl: ".jsonl",
    "otlp-json": ".json",
  };

type SpanSearchQuery = {
  limit: number;
  span_id?: string[];
  trace_id?: string[];
  cursor?: string;
};

type SpanPage<Span> = { data: Span[]; next_cursor?: string | null };

/** Makes a name safe to use in a file name. */
export function sanitizeSpanDownloadFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

/** Returns a filesystem-friendly timestamp for generated download names. */
export function getSpanDownloadTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/:/g, "-");
}

/**
 * Turns an openapi-fetch error into an Error that preserves the HTTP status
 * and any server-provided detail.
 */
function toDownloadError({
  status,
  error,
}: {
  status: number;
  error: unknown;
}): Error {
  const detail =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "detail" in error
        ? String((error as { detail: unknown }).detail)
        : "";
  return new Error(detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`);
}

/**
 * Fetches every span matching the given span or trace IDs and hands each page
 * to the caller as it arrives.
 */
async function fetchSpans<Span>({
  spanIds,
  traceIds,
  fetchPage,
  onPage,
}: {
  spanIds?: string[];
  traceIds?: string[];
  fetchPage: (query: SpanSearchQuery) => Promise<SpanPage<Span>>;
  onPage: (spans: Span[]) => void;
}): Promise<void> {
  const useSpanIds = spanIds != null;
  const idList = spanIds ?? traceIds ?? [];
  for (const batch of chunk(idList, ID_BATCH_SIZE)) {
    let cursor: string | null = null;
    do {
      const page = await fetchPage({
        limit: PAGE_SIZE,
        ...(useSpanIds ? { span_id: batch } : { trace_id: batch }),
        ...(cursor ? { cursor } : {}),
      });
      onPage(page.data);
      cursor = page.next_cursor ?? null;
    } while (cursor);
  }
}

async function fetchOtlpSpanPage({
  projectId,
  query,
}: {
  projectId: string;
  query: SpanSearchQuery;
}): Promise<SpanPage<OtlpSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans/otlpv1",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError({ status: response.status, error });
  }
  return data;
}

async function fetchSpanPage({
  projectId,
  query,
}: {
  projectId: string;
  query: SpanSearchQuery;
}): Promise<SpanPage<PhoenixSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError({ status: response.status, error });
  }
  return data;
}

/** Downloads blob parts without first joining them into one large JS string. */
function downloadBlob({
  fileName,
  parts,
  type,
}: {
  fileName: string;
  parts: BlobPart[];
  type: string;
}) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
}

/** Downloads spans or complete traces in one of the bulk export formats. */
export async function downloadSpanCollection({
  projectId,
  spanIds,
  traceIds,
  format,
  fileName,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
  format: SpanDownloadFormat;
  fileName: string;
}): Promise<void> {
  const parts: BlobPart[] = [];
  if (format === "jsonl") {
    await fetchSpans<PhoenixSpan>({
      spanIds,
      traceIds,
      fetchPage: (query) => fetchSpanPage({ projectId, query }),
      onPage: (spans) => {
        if (spans.length === 0) {
          return;
        }
        parts.push(spans.map((span) => JSON.stringify(span)).join("\n"));
        parts.push("\n");
      },
    });
    downloadBlob({
      fileName,
      parts,
      type: "application/x-ndjson",
    });
    return;
  }

  parts.push('{"resource_spans":[{"scope_spans":[{"spans":[');
  let isFirstPage = true;
  await fetchSpans<OtlpSpan>({
    spanIds,
    traceIds,
    fetchPage: (query) => fetchOtlpSpanPage({ projectId, query }),
    onPage: (spans) => {
      if (spans.length === 0) {
        return;
      }
      const serialized = spans.map((span) => JSON.stringify(span)).join(",");
      parts.push(isFirstPage ? serialized : `,${serialized}`);
      isFirstPage = false;
    },
  });
  parts.push("]}]}]}");
  downloadBlob({
    fileName,
    parts,
    type: "application/json",
  });
}

/** Downloads one span as Phoenix JSON or an OTLP JSON export. */
export async function downloadSingleSpan({
  projectId,
  spanId,
  format,
  fileName,
}: {
  projectId: string;
  spanId: string;
  format: SingleSpanDownloadFormat;
  fileName: string;
}): Promise<void> {
  if (format === "otlp-json") {
    await downloadSpanCollection({
      projectId,
      spanIds: [spanId],
      format,
      fileName,
    });
    return;
  }

  const page = await fetchSpanPage({
    projectId,
    query: { limit: 1, span_id: [spanId] },
  });
  const span = page.data[0];
  if (span == null) {
    throw new Error("Span not found");
  }
  downloadBlob({
    fileName,
    parts: [JSON.stringify(span, null, 2), "\n"],
    type: "application/json",
  });
}
